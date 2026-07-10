import CoreBluetooth
import ExpoModulesCore
import Foundation

public class ExpoPansBleApiModule: Module {
  private let pansServiceUuid = CBUUID(string: PansBleApiConstants.pansServiceUuid)
  private let gapServiceUuid = CBUUID(string: PansBleApiConstants.gapServiceUuid)
  private let requiredCommonCharacteristicUuids = Set(
    PansBleApiConstants.requiredCommonCharacteristicUuids.map { CBUUID(string: $0) }
  )

  private var centralManager: CBCentralManager?
  private var bluetoothDelegate: ExpoPansBleApiBluetoothDelegate?
  private var pendingScanPromise: Promise?
  private var pendingPermissionPromise: Promise?
  private var isScanning = false
  private var discoveredPeripherals = [String: CBPeripheral]()
  private var discoveredMetadata = [String: [String: Any?]]()
  private var connections = [String: PeripheralContext]()
  private var disconnectingDeviceIds = Set<String>()
  private var nextOperationId: UInt64 = 1

  public func definition() -> ModuleDefinition {
    Name("ExpoPansBleApi")

    Events(
      "onDeviceDiscovered",
      "onConnectionStateChanged",
      "onCharacteristicNotification",
      "onError"
    )

    OnCreate {
      self.ensureCentralManager()
    }

    OnDestroy {
      self.stopScanningInternal()
      self.pendingPermissionPromise?.reject("OPERATION_FAILED", "Module was destroyed.")
      self.pendingPermissionPromise = nil
      Array(self.connections.keys).forEach {
        self.closeConnection(
          deviceId: $0,
          reason: "module destroyed",
          rejectConnect: true
        )
      }
      self.disconnectingDeviceIds.removeAll()
      self.discoveredPeripherals.removeAll()
      self.discoveredMetadata.removeAll()
      self.centralManager?.delegate = nil
      self.centralManager = nil
      self.bluetoothDelegate = nil
    }

    AsyncFunction("startScanning") { (promise: Promise) in
      self.ensureCentralManager()
      guard let manager = self.centralManager else {
        promise.reject("BLUETOOTH_UNAVAILABLE", "CoreBluetooth central manager is unavailable.")
        return
      }
      if self.isScanning {
        promise.resolve(nil)
        return
      }
      if manager.state == .poweredOn {
        self.startScan(manager)
        promise.resolve(nil)
      } else if manager.state == .unknown || manager.state == .resetting {
        // Keep at most one deferred start. A duplicate start while CoreBluetooth is
        // initializing is rejected deterministically instead of replacing the
        // original promise and leaving callers unsure which request will settle.
        guard self.pendingScanPromise == nil else {
          promise.reject(
            "OPERATION_FAILED",
            "A scan start is already pending while Bluetooth initializes."
          )
          return
        }
        self.pendingScanPromise = promise
      } else {
        promise.reject("BLUETOOTH_UNAVAILABLE", "Bluetooth is not powered on.")
      }
    }

    Function("stopScanning") {
      self.stopScanningInternal()
    }

    Function("clearDevices") {
      self.discoveredPeripherals.removeAll()
      self.discoveredMetadata.removeAll()
    }

    Function("getCapabilities") {
      PansBleApiConstants.iosCapabilities
    }

    Function("getPermissionStatus") {
      self.permissionStatusMap()
    }

    AsyncFunction("requestPermissions") { (promise: Promise) in
      self.requestBluetoothPermission(promise)
    }

    AsyncFunction("connect") { (deviceId: String, timeoutMs: Int?, promise: Promise) in
      guard !deviceId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        promise.reject("INVALID_ARGUMENT", "deviceId must be non-empty.")
        return
      }
      if let timeoutMs, timeoutMs <= 0 {
        promise.reject("INVALID_ARGUMENT", "timeoutMs must be a positive integer.")
        return
      }
      guard let manager = self.centralManager else {
        promise.reject("BLUETOOTH_UNAVAILABLE", "CoreBluetooth central manager is unavailable.")
        return
      }
      guard manager.state == .poweredOn else {
        promise.reject("BLUETOOTH_UNAVAILABLE", "Bluetooth is not powered on.")
        return
      }
      guard let peripheral = self.discoveredPeripherals[deviceId] else {
        promise.reject("DEVICE_NOT_FOUND", "Device \(deviceId) has not been discovered.")
        return
      }

      if let existing = self.connections[deviceId] {
        if existing.state == "connected" {
          promise.resolve(true)
        } else {
          promise.reject(
            "OPERATION_FAILED",
            "A connection attempt is already in progress."
          )
        }

        return
      }

      guard !self.disconnectingDeviceIds.contains(deviceId) else {
        promise.reject(
          "OPERATION_FAILED",
          "Device disconnect is still in progress."
        )
        return
      }

      let context = PeripheralContext(deviceId: deviceId, peripheral: peripheral)
      context.connectPromise = promise
      self.connections[deviceId] = context
      peripheral.delegate = self.ensureBluetoothDelegate()
      self.sendConnectionState(deviceId: deviceId, state: "connecting", reason: nil)
      context.connectTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(timeoutMs ?? 15000) / 1000.0, repeats: false) { [weak self, weak context] _ in
        guard
          let self,
          let context,
          let current = self.connections[deviceId],
          current === context,
          context.connectPromise != nil
        else { return }
        context.connectPromise?.reject("TIMEOUT", "Timed out connecting to \(deviceId).")
        context.connectPromise = nil
        self.closeConnection(deviceId: deviceId, reason: "timeout", rejectConnect: true)
      }
      manager.connect(peripheral)
    }

    AsyncFunction("disconnect") { (deviceId: String, promise: Promise) in
      self.closeConnection(deviceId: deviceId, reason: "local disconnect", rejectConnect: false)
      promise.resolve(true)
    }

    AsyncFunction("readCharacteristic") { (deviceId: String, characteristicUuid: String, promise: Promise) in
      guard let uuid = self.parseUuid(characteristicUuid, promise: promise) else { return }
      self.enqueue(deviceId: deviceId, operation: .read(id: self.allocateOperationId(), uuid, promise))
    }

    AsyncFunction("writeCharacteristic") { (deviceId: String, characteristicUuid: String, payload: [Int], writeType: String?, promise: Promise) in
      guard let uuid = self.parseUuid(characteristicUuid, promise: promise),
            let data = self.validatePayload(payload, promise: promise),
            let type = self.normalizeWriteType(writeType, promise: promise) else { return }
      self.enqueue(deviceId: deviceId, operation: .write(id: self.allocateOperationId(), uuid, data, type, promise))
    }

    AsyncFunction("setCharacteristicNotifications") { (deviceId: String, characteristicUuid: String, enabled: Bool, promise: Promise) in
      guard let uuid = self.parseUuid(characteristicUuid, promise: promise) else { return }
      self.enqueue(deviceId: deviceId, operation: .notify(id: self.allocateOperationId(), uuid, enabled, promise))
    }

    AsyncFunction("getMaximumWriteValueLength") { (deviceId: String, writeType: String, promise: Promise) in
      guard let context = self.connections[deviceId], context.state == "connected" else {
        promise.reject("NOT_CONNECTED", "Device \(deviceId) is not connected.")
        return
      }
      guard let type = self.normalizeWriteType(writeType, promise: promise) else { return }
      promise.resolve(context.peripheral.maximumWriteValueLength(for: type))
    }
  }

  public func centralManagerDidUpdateState(_ central: CBCentralManager) {
    settlePendingPermissionForCentralState(central.state)

    if central.state == .poweredOn {
      if let promise = pendingScanPromise {
        pendingScanPromise = nil
        startScan(central)
        promise.resolve(nil)
      }
    } else if central.state == .unauthorized {
      rejectPendingScanStart(code: "PERMISSION_DENIED", message: "Bluetooth permission is not authorized.")
      closeAllConnections(reason: "bluetooth unavailable")
      sendError(code: "PERMISSION_DENIED", message: "Bluetooth permission is not authorized.")
    } else if central.state == .unsupported || central.state == .poweredOff {
      rejectPendingScanStart(code: "BLUETOOTH_UNAVAILABLE", message: "Bluetooth is unavailable or powered off.")
      isScanning = false
      closeAllConnections(reason: "bluetooth unavailable")
      sendError(code: "BLUETOOTH_UNAVAILABLE", message: "Bluetooth is unavailable or powered off.")
    }
  }

  public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
    guard let pansData = extractPansServiceData(advertisementData: advertisementData) else { return }
    let deviceId = peripheral.identifier.uuidString
    discoveredPeripherals[deviceId] = peripheral
    let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String
    discoveredMetadata[deviceId] = [
      "deviceId": deviceId,
      "name": name,
      "rssi": RSSI.intValue,
      "lastSeenMs": Date().timeIntervalSince1970 * 1000.0,
      "presence": PansBleApiCodec.decodePresence(pansData),
    ]
    sendEvent("onDeviceDiscovered", ["devices": Array(discoveredMetadata.values)])
  }

  public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    peripheral.discoverServices([pansServiceUuid, gapServiceUuid])
  }

  public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    disconnectingDeviceIds.remove(deviceId)
    connections[deviceId]?.connectPromise?.reject("GATT_ERROR", error?.localizedDescription ?? "Failed to connect.")
    connections[deviceId]?.connectPromise = nil
    closeConnection(deviceId: deviceId, reason: "connect failed", rejectConnect: true)
  }

  public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    disconnectingDeviceIds.remove(deviceId)
    closeConnection(deviceId: deviceId, reason: error?.localizedDescription ?? "remote disconnect", rejectConnect: true)
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let context = connections[deviceId] else { return }
    if let error {
      context.connectPromise?.reject("GATT_ERROR", "Service discovery failed: \(error.localizedDescription)")
      context.connectPromise = nil
      closeConnection(deviceId: deviceId, reason: "service discovery failed", rejectConnect: true)
      return
    }
    guard let services = peripheral.services, services.contains(where: { $0.uuid == pansServiceUuid }) else {
      context.connectPromise?.reject("SERVICE_NOT_FOUND", "PANS network-node service was not discovered.")
      context.connectPromise = nil
      closeConnection(deviceId: deviceId, reason: "service missing", rejectConnect: true)
      return
    }
    context.pendingServiceCount = services.count
    services.forEach { peripheral.discoverCharacteristics(nil, for: $0) }
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let context = connections[deviceId] else { return }
    if let error {
      context.connectPromise?.reject("GATT_ERROR", "Characteristic discovery failed: \(error.localizedDescription)")
      context.connectPromise = nil
      closeConnection(deviceId: deviceId, reason: "characteristic discovery failed", rejectConnect: true)
      return
    }
    service.characteristics?.forEach { context.characteristics[$0.uuid] = $0 }
    context.pendingServiceCount -= 1
    if context.pendingServiceCount <= 0 {
      let missing = requiredCommonCharacteristicUuids.filter { context.characteristics[$0] == nil }
      if !missing.isEmpty {
        context.connectPromise?.reject("CHARACTERISTIC_NOT_FOUND", "PANS service is missing required characteristics: \(missing.map { $0.uuidString }.joined(separator: ", ")).")
        context.connectPromise = nil
        closeConnection(deviceId: deviceId, reason: "required characteristics missing", rejectConnect: true)
        return
      }
      context.connectTimer?.invalidate()
      context.connectTimer = nil
      context.state = "connected"
      context.connectPromise?.resolve(true)
      context.connectPromise = nil
      sendConnectionState(deviceId: deviceId, state: "connected", reason: nil)
      startNextOperation(context)
    }
  }

  public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let context = connections[deviceId] else { return }
    if case .read(_, let uuid, let promise)? = context.activeOperation, uuid == characteristic.uuid {
      clearActiveOperation(context)
      if let error {
        promise.reject("GATT_ERROR", error.localizedDescription)
      } else {
        promise.resolve(Array(characteristic.value ?? Data()).map { Int($0) })
      }
      startNextOperation(context)
      return
    }
    sendEvent("onCharacteristicNotification", [
      "deviceId": deviceId,
      "characteristicUuid": characteristic.uuid.uuidString.lowercased(),
      "payload": Array(characteristic.value ?? Data()).map { Int($0) },
    ])
  }

  public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let context = connections[deviceId],
          case .write(_, let uuid, _, let type, let promise)? = context.activeOperation,
          uuid == characteristic.uuid,
          type == .withResponse else { return }
    clearActiveOperation(context)
    if let error {
      promise.reject("GATT_ERROR", error.localizedDescription)
    } else {
      promise.resolve(true)
    }
    startNextOperation(context)
  }

  public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let context = connections[deviceId],
          case .notify(_, let uuid, _, let promise)? = context.activeOperation,
          uuid == characteristic.uuid else { return }
    clearActiveOperation(context)
    if let error {
      promise.reject("GATT_ERROR", error.localizedDescription)
    } else {
      promise.resolve(true)
    }
    startNextOperation(context)
  }

  public func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
    guard let context = connections[peripheral.identifier.uuidString] else { return }
    attemptActiveWriteWithoutResponse(context)
  }

  private func ensureCentralManager() {
    if centralManager == nil {
      centralManager = CBCentralManager(delegate: ensureBluetoothDelegate(), queue: nil)
    }
  }

  private func ensureBluetoothDelegate() -> ExpoPansBleApiBluetoothDelegate {
    if let bluetoothDelegate {
      return bluetoothDelegate
    }

    let bluetoothDelegate = ExpoPansBleApiBluetoothDelegate(module: self)
    self.bluetoothDelegate = bluetoothDelegate
    return bluetoothDelegate
  }

  private func startScan(_ manager: CBCentralManager) {
    guard !isScanning else { return }
    manager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
    isScanning = true
  }

  private func stopScanningInternal() {
    rejectPendingScanStart(
      code: "OPERATION_FAILED",
      message: "Pending scan start was cancelled."
    )
    centralManager?.stopScan()
    isScanning = false
  }

  private func rejectPendingScanStart(code: String, message: String) {
    pendingScanPromise?.reject(code, message)
    pendingScanPromise = nil
  }

  private func requestBluetoothPermission(_ promise: Promise) {
    ensureCentralManager()

    if bluetoothPermissionStatus() != "undetermined" {
      promise.resolve(permissionStatusMap())
      return
    }

    guard pendingPermissionPromise == nil else {
      promise.reject(
        "OPERATION_FAILED",
        "A Bluetooth permission request is already pending while CoreBluetooth initializes."
      )
      return
    }

    pendingPermissionPromise = promise
    if let manager = centralManager {
      settlePendingPermissionForCentralState(manager.state)
    }
  }

  private func settlePendingPermissionForCentralState(_ state: CBManagerState) {
    guard let promise = pendingPermissionPromise else { return }

    let bluetoothStatus = bluetoothPermissionStatus()
    guard bluetoothStatus != "undetermined" || (state != .unknown && state != .resetting) else { return }

    pendingPermissionPromise = nil
    promise.resolve(permissionStatusMap())
  }

  private func closeAllConnections(reason: String) {
    Array(connections.keys).forEach {
      closeConnection(
        deviceId: $0,
        reason: reason,
        rejectConnect: true
      )
    }
  }

  private func extractPansServiceData(advertisementData: [String: Any]) -> Data? {
    guard let serviceData = advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data],
          !serviceData.isEmpty else { return nil }

    var serviceDataByUuid = [String: Data]()
    serviceData.forEach { serviceDataByUuid[$0.key.uuidString] = $0.value }
    return PansBleApiCodec.extractPansServiceData(serviceDataByUuid)
  }

  private func enqueue(deviceId: String, operation: GattOperation) {
    guard !deviceId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      operation.promise.reject("INVALID_ARGUMENT", "deviceId must be non-empty.")
      return
    }
    guard let context = connections[deviceId], context.state == "connected", !context.isClosed else {
      operation.promise.reject("NOT_CONNECTED", "Device \(deviceId) is not connected.")
      return
    }
    context.queue.append(operation)
    if context.activeOperation == nil { startNextOperation(context) }
  }

  private func startNextOperation(_ context: PeripheralContext) {
    guard !context.isClosed, context.activeOperation == nil, !context.queue.isEmpty else { return }
    let operation = context.queue.removeFirst()
    context.activeOperation = operation
    context.activeOperationTimer?.invalidate()
    context.activeOperationTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: false) { [weak self, weak context] _ in
      guard
        let self,
        let context,
        let current = self.connections[context.deviceId],
        current === context,
        context.activeOperation?.id == operation.id
      else { return }
      let timedOut = context.activeOperation
      self.clearActiveOperation(context)
      timedOut?.promise.reject("TIMEOUT", "GATT operation timed out.")
      self.closeConnection(
        deviceId: context.deviceId,
        reason: "gatt operation timeout",
        rejectConnect: true
      )
    }

    switch operation {
    case .read(_, let uuid, let promise):
      guard let characteristic = context.characteristics[uuid] else {
        clearActiveOperation(context)
        promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic \(uuid.uuidString) was not discovered.")
        startNextOperation(context)
        return
      }
      context.peripheral.readValue(for: characteristic)
    case .write(_, let uuid, let data, let type, let promise):
      guard let characteristic = context.characteristics[uuid] else {
        clearActiveOperation(context)
        promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic \(uuid.uuidString) was not discovered.")
        startNextOperation(context)
        return
      }
      if type == .withoutResponse {
        attemptActiveWriteWithoutResponse(context)
      } else {
        context.peripheral.writeValue(data, for: characteristic, type: type)
      }
    case .notify(_, let uuid, let enabled, let promise):
      guard let characteristic = context.characteristics[uuid] else {
        clearActiveOperation(context)
        promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic \(uuid.uuidString) was not discovered.")
        startNextOperation(context)
        return
      }
      context.peripheral.setNotifyValue(enabled, for: characteristic)
    }
  }

  private func attemptActiveWriteWithoutResponse(_ context: PeripheralContext) {
    guard case .write(_, let uuid, let data, let type, let promise)? = context.activeOperation,
          type == .withoutResponse else { return }
    guard let characteristic = context.characteristics[uuid] else {
      clearActiveOperation(context)
      promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic \(uuid.uuidString) was not discovered.")
      startNextOperation(context)
      return
    }
    guard context.peripheral.canSendWriteWithoutResponse else { return }
    context.peripheral.writeValue(data, for: characteristic, type: .withoutResponse)
    clearActiveOperation(context)
    promise.resolve(true)
    startNextOperation(context)
  }

  private func clearActiveOperation(_ context: PeripheralContext) {
    context.activeOperationTimer?.invalidate()
    context.activeOperationTimer = nil
    context.activeOperation = nil
  }

  private func closeConnection(deviceId: String, reason: String, rejectConnect: Bool) {
    guard let context = connections.removeValue(forKey: deviceId), !context.isClosed else { return }
    context.isClosed = true
    context.connectTimer?.invalidate()
    context.connectTimer = nil
    let activeOperation = context.activeOperation
    clearActiveOperation(context)
    activeOperation?.promise.reject("NOT_CONNECTED", "Device disconnected.")
    if rejectConnect {
      context.connectPromise?.reject("NOT_CONNECTED", "Device disconnected.")
    } else {
      context.connectPromise?.resolve(false)
    }
    context.connectPromise = nil
    context.queue.forEach { $0.promise.reject("NOT_CONNECTED", "Device disconnected.") }
    context.queue.removeAll()
    if context.peripheral.state != .disconnected {
      disconnectingDeviceIds.insert(deviceId)
    }
    centralManager?.cancelPeripheralConnection(context.peripheral)
    sendConnectionState(deviceId: deviceId, state: "disconnected", reason: reason)
  }

  private func permissionStatusMap() -> [String: Any] {
    let bluetooth = bluetoothPermissionStatus()
    return ["bluetooth": bluetooth, "canAskAgain": bluetooth == "undetermined"]
  }

  private func bluetoothPermissionStatus() -> String {
    let authorization = CBCentralManager.authorization
    switch authorization {
    case .allowedAlways: return "granted"
    case .denied, .restricted: return "denied"
    case .notDetermined: return "undetermined"
    @unknown default: return "unavailable"
    }
  }

  private func parseUuid(_ value: String, promise: Promise) -> CBUUID? {
    do {
      return CBUUID(string: try PansBleApiCodec.normalizeUuidString(value))
    } catch {
      promise.reject("INVALID_ARGUMENT", error.localizedDescription)
      return nil
    }
  }

  private func validatePayload(_ payload: [Int], promise: Promise) -> Data? {
    do {
      return try PansBleApiCodec.validatePayload(payload)
    } catch {
      promise.reject("INVALID_ARGUMENT", error.localizedDescription)
      return nil
    }
  }

  private func normalizeWriteType(_ writeType: String?, promise: Promise) -> CBCharacteristicWriteType? {
    switch writeType ?? "withResponse" {
    case "withResponse": return .withResponse
    case "withoutResponse": return .withoutResponse
    default:
      promise.reject("INVALID_ARGUMENT", "writeType must be withResponse or withoutResponse.")
      return nil
    }
  }

  private func allocateOperationId() -> UInt64 {
    defer { nextOperationId += 1 }
    return nextOperationId
  }

  private func sendConnectionState(deviceId: String, state: String, reason: String?) {
    sendEvent("onConnectionStateChanged", [
      "deviceId": deviceId,
      "state": state,
      "reason": reason as Any,
    ])
  }

  private func sendError(code: String, message: String) {
    sendEvent("onError", ["code": code, "message": message])
  }
}

private final class ExpoPansBleApiBluetoothDelegate: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  private weak var module: ExpoPansBleApiModule?

  init(module: ExpoPansBleApiModule) {
    self.module = module
    super.init()
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    module?.centralManagerDidUpdateState(central)
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
    module?.centralManager(central, didDiscover: peripheral, advertisementData: advertisementData, rssi: RSSI)
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    module?.centralManager(central, didConnect: peripheral)
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    module?.centralManager(central, didFailToConnect: peripheral, error: error)
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    module?.centralManager(central, didDisconnectPeripheral: peripheral, error: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    module?.peripheral(peripheral, didDiscoverServices: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    module?.peripheral(peripheral, didDiscoverCharacteristicsFor: service, error: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    module?.peripheral(peripheral, didUpdateValueFor: characteristic, error: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    module?.peripheral(peripheral, didWriteValueFor: characteristic, error: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
    module?.peripheral(peripheral, didUpdateNotificationStateFor: characteristic, error: error)
  }

  func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
    module?.peripheralIsReady(toSendWriteWithoutResponse: peripheral)
  }
}

private final class PeripheralContext {
  let deviceId: String
  let peripheral: CBPeripheral
  var state = "connecting"
  var characteristics = [CBUUID: CBCharacteristic]()
  var connectPromise: Promise?
  var connectTimer: Timer?
  var pendingServiceCount = 0
  var queue = [GattOperation]()
  var activeOperation: GattOperation?
  var activeOperationTimer: Timer?
  var isClosed = false

  init(deviceId: String, peripheral: CBPeripheral) {
    self.deviceId = deviceId
    self.peripheral = peripheral
  }
}

private enum GattOperation {
  case read(id: UInt64, CBUUID, Promise)
  case write(id: UInt64, CBUUID, Data, CBCharacteristicWriteType, Promise)
  case notify(id: UInt64, CBUUID, Bool, Promise)

  var id: UInt64 {
    switch self {
    case .read(let id, _, _): return id
    case .write(let id, _, _, _, _): return id
    case .notify(let id, _, _, _): return id
    }
  }

  var promise: Promise {
    switch self {
    case .read(_, _, let promise): return promise
    case .write(_, _, _, _, let promise): return promise
    case .notify(_, _, _, let promise): return promise
    }
  }
}
