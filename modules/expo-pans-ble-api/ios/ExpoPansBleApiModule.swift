import CoreBluetooth
import ExpoModulesCore

public class ExpoPansBleApiModule: Module, CBCentralManagerDelegate, CBPeripheralDelegate {
  private let pansServiceUuid = CBUUID(string: "680c21d9-c946-4c1f-9c11-baa1c21329e7")
  private let gapServiceUuid = CBUUID(string: "00001800-0000-1000-8000-00805f9b34fb")
  private var centralManager: CBCentralManager?
  private var shouldScanWhenPoweredOn = false
  private var discoveredPeripherals = [String: CBPeripheral]()
  private var discoveredMetadata = [String: [String: Any?]]()
  private var connections = [String: PeripheralContext]()

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
      self.connections.keys.forEach { self.closeConnection(deviceId: $0, reason: "module destroyed") }
      self.discoveredPeripherals.removeAll()
      self.discoveredMetadata.removeAll()
      self.centralManager?.delegate = nil
      self.centralManager = nil
    }

    AsyncFunction("startScanning") { (promise: Promise) in
      self.ensureCentralManager()
      guard let manager = self.centralManager else {
        promise.reject("BLUETOOTH_UNAVAILABLE", "CoreBluetooth central manager is unavailable.")
        return
      }
      if manager.state == .poweredOn {
        manager.scanForPeripherals(withServices: [self.pansServiceUuid], options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        promise.resolve(nil)
      } else if manager.state == .unknown || manager.state == .resetting {
        self.shouldScanWhenPoweredOn = true
        promise.resolve(nil)
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
      [
        "transport": "ble",
        "supportsScanning": true,
        "supportsConnection": true,
        "supportsNotifications": true,
        "supportsMtuRequest": false,
        "supportsMaximumWriteValueLength": true
      ] as [String: Any]
    }

    Function("getPermissionStatus") {
      self.permissionStatusMap()
    }

    AsyncFunction("requestPermissions") { (promise: Promise) in
      self.ensureCentralManager()
      promise.resolve(self.permissionStatusMap())
    }

    AsyncFunction("connect") { (deviceId: String, timeoutMs: Int?, promise: Promise) in
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

      self.connections[deviceId]?.connectPromise?.resolve(false)
      let context = PeripheralContext(deviceId: deviceId, peripheral: peripheral)
      context.connectPromise = promise
      self.connections[deviceId] = context
      peripheral.delegate = self
      self.sendConnectionState(deviceId: deviceId, state: "connecting", reason: nil)
      context.connectTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(timeoutMs ?? 15000) / 1000.0, repeats: false) { _ in
        if self.connections[deviceId]?.connectPromise != nil {
          self.connections[deviceId]?.connectPromise?.reject("TIMEOUT", "Timed out connecting to \(deviceId).")
          self.connections[deviceId]?.connectPromise = nil
          self.closeConnection(deviceId: deviceId, reason: "timeout")
        }
      }
      manager.connect(peripheral)
    }

    AsyncFunction("disconnect") { (deviceId: String, promise: Promise) in
      self.closeConnection(deviceId: deviceId, reason: "local disconnect")
      promise.resolve(true)
    }

    AsyncFunction("readCharacteristic") { (deviceId: String, characteristicUuid: String, promise: Promise) in
      self.enqueue(deviceId: deviceId, operation: .read(CBUUID(string: characteristicUuid), promise))
    }

    AsyncFunction("writeCharacteristic") { (deviceId: String, characteristicUuid: String, payload: [Int], writeType: String?, promise: Promise) in
      let data = Data(payload.map { UInt8(truncatingIfNeeded: $0) })
      let type: CBCharacteristicWriteType = writeType == "withoutResponse" ? .withoutResponse : .withResponse
      self.enqueue(deviceId: deviceId, operation: .write(CBUUID(string: characteristicUuid), data, type, promise))
    }

    AsyncFunction("setCharacteristicNotifications") { (deviceId: String, characteristicUuid: String, enabled: Bool, promise: Promise) in
      self.enqueue(deviceId: deviceId, operation: .notify(CBUUID(string: characteristicUuid), enabled, promise))
    }

    AsyncFunction("getMaximumWriteValueLength") { (deviceId: String, writeType: String, promise: Promise) in
      guard let context = self.connections[deviceId] else {
        promise.reject("NOT_CONNECTED", "Device \(deviceId) is not connected.")
        return
      }
      let type: CBCharacteristicWriteType = writeType == "withoutResponse" ? .withoutResponse : .withResponse
      promise.resolve(context.peripheral.maximumWriteValueLength(for: type))
    }
  }

  public func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state == .poweredOn && shouldScanWhenPoweredOn {
      shouldScanWhenPoweredOn = false
      central.scanForPeripherals(withServices: [pansServiceUuid], options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
    } else if central.state == .unauthorized {
      sendError(code: "PERMISSION_DENIED", message: "Bluetooth permission is not authorized.")
    } else if central.state == .unsupported || central.state == .poweredOff {
      sendError(code: "BLUETOOTH_UNAVAILABLE", message: "Bluetooth is unavailable or powered off.")
    }
  }

  public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
    let deviceId = peripheral.identifier.uuidString
    discoveredPeripherals[deviceId] = peripheral
    let serviceData = advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data]
    let presence = serviceData?[pansServiceUuid].flatMap { decodePresence($0) }
    let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String
    discoveredMetadata[deviceId] = [
      "deviceId": deviceId,
      "name": name,
      "rssi": RSSI.intValue,
      "lastSeenMs": Date().timeIntervalSince1970 * 1000.0,
      "presence": presence
    ]
    sendEvent("onDeviceDiscovered", ["devices": Array(discoveredMetadata.values)])
  }

  public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    let deviceId = peripheral.identifier.uuidString
    peripheral.discoverServices([pansServiceUuid, gapServiceUuid])
  }

  public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    connections[deviceId]?.connectPromise?.reject("GATT_ERROR", error?.localizedDescription ?? "Failed to connect.")
    connections[deviceId]?.connectPromise = nil
    closeConnection(deviceId: deviceId, reason: "connect failed")
  }

  public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    closeConnection(deviceId: peripheral.identifier.uuidString, reason: error?.localizedDescription ?? "remote disconnect")
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let context = connections[deviceId] else { return }
    if let error = error {
      context.connectPromise?.reject("GATT_ERROR", error.localizedDescription)
      context.connectPromise = nil
      closeConnection(deviceId: deviceId, reason: "service discovery failed")
      return
    }
    guard let services = peripheral.services, services.contains(where: { $0.uuid == pansServiceUuid }) else {
      context.connectPromise?.reject("SERVICE_NOT_FOUND", "PANS network-node service was not discovered.")
      context.connectPromise = nil
      closeConnection(deviceId: deviceId, reason: "service missing")
      return
    }
    context.pendingServiceCount = services.count
    services.forEach { peripheral.discoverCharacteristics(nil, for: $0) }
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let context = connections[deviceId] else { return }
    service.characteristics?.forEach { context.characteristics[$0.uuid] = $0 }
    context.pendingServiceCount -= 1
    if context.pendingServiceCount <= 0 {
      context.connectTimer?.invalidate()
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
    if case .read(let uuid, let promise)? = context.activeOperation, uuid == characteristic.uuid {
      context.activeOperation = nil
      if let error = error {
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
      "payload": Array(characteristic.value ?? Data()).map { Int($0) }
    ])
  }

  public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    finishActiveOperation(deviceId: peripheral.identifier.uuidString, error: error)
  }

  public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
    finishActiveOperation(deviceId: peripheral.identifier.uuidString, error: error)
  }

  public func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
    if let context = connections[peripheral.identifier.uuidString] {
      startNextOperation(context)
    }
  }

  private func ensureCentralManager() {
    if centralManager == nil {
      centralManager = CBCentralManager(delegate: self, queue: nil)
    }
  }

  private func stopScanningInternal() {
    shouldScanWhenPoweredOn = false
    centralManager?.stopScan()
  }

  private func enqueue(deviceId: String, operation: GattOperation) {
    guard let context = connections[deviceId], context.state == "connected" else {
      operation.promise.reject("NOT_CONNECTED", "Device \(deviceId) is not connected.")
      return
    }
    context.queue.append(operation)
    if context.activeOperation == nil { startNextOperation(context) }
  }

  private func startNextOperation(_ context: PeripheralContext) {
    guard context.activeOperation == nil, !context.queue.isEmpty else { return }
    let operation = context.queue.removeFirst()
    context.activeOperation = operation
    switch operation {
    case .read(let uuid, let promise):
      guard let characteristic = context.characteristics[uuid] else {
        context.activeOperation = nil
        promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic \(uuid.uuidString) was not discovered.")
        startNextOperation(context)
        return
      }
      context.peripheral.readValue(for: characteristic)
    case .write(let uuid, let data, let type, let promise):
      guard let characteristic = context.characteristics[uuid] else {
        context.activeOperation = nil
        promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic \(uuid.uuidString) was not discovered.")
        startNextOperation(context)
        return
      }
      if type == .withoutResponse {
        guard context.peripheral.canSendWriteWithoutResponse else { return }
        context.peripheral.writeValue(data, for: characteristic, type: type)
        context.activeOperation = nil
        promise.resolve(true)
        startNextOperation(context)
      } else {
        context.peripheral.writeValue(data, for: characteristic, type: type)
      }
    case .notify(let uuid, let enabled, let promise):
      guard let characteristic = context.characteristics[uuid] else {
        context.activeOperation = nil
        promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic \(uuid.uuidString) was not discovered.")
        startNextOperation(context)
        return
      }
      context.peripheral.setNotifyValue(enabled, for: characteristic)
    }
  }

  private func finishActiveOperation(deviceId: String, error: Error?) {
    guard let context = connections[deviceId], let operation = context.activeOperation else { return }
    context.activeOperation = nil
    if let error = error {
      operation.promise.reject("GATT_ERROR", error.localizedDescription)
    } else {
      operation.promise.resolve(true)
    }
    startNextOperation(context)
  }

  private func closeConnection(deviceId: String, reason: String) {
    guard let context = connections.removeValue(forKey: deviceId) else { return }
    context.connectTimer?.invalidate()
    context.connectPromise?.resolve(false)
    context.activeOperation?.promise.reject("NOT_CONNECTED", "Device disconnected.")
    context.queue.forEach { $0.promise.reject("NOT_CONNECTED", "Device disconnected.") }
    centralManager?.cancelPeripheralConnection(context.peripheral)
    sendConnectionState(deviceId: deviceId, state: "disconnected", reason: reason)
  }

  private func permissionStatusMap() -> [String: Any] {
    let authorization = CBCentralManager.authorization
    let bluetooth: String
    switch authorization {
    case .allowedAlways: bluetooth = "granted"
    case .denied, .restricted: bluetooth = "denied"
    case .notDetermined: bluetooth = "undetermined"
    @unknown default: bluetooth = "unavailable"
    }
    return ["bluetooth": bluetooth, "canAskAgain": authorization == .notDetermined]
  }

  private func decodePresence(_ data: Data) -> [String: Any]? {
    guard data.count >= 2 else { return nil }
    let op = Int(data[0])
    let change = Int(data[1])
    let uwbMode: String
    switch op & 0x03 {
    case 1: uwbMode = "passive"
    case 2: uwbMode = "active"
    default: uwbMode = "off"
    }
    return [
      "rawOperationModeByte": op,
      "role": (op & 0x80) != 0 ? "anchor" : "tag",
      "errorIndicated": (op & 0x10) != 0,
      "initiator": (op & 0x08) != 0,
      "bridge": (op & 0x04) != 0,
      "uwbMode": uwbMode,
      "changeCounter": change
    ]
  }

  private func sendConnectionState(deviceId: String, state: String, reason: String?) {
    sendEvent("onConnectionStateChanged", [
      "deviceId": deviceId,
      "state": state,
      "reason": reason as Any
    ])
  }

  private func sendError(code: String, message: String) {
    sendEvent("onError", ["code": code, "message": message])
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

  init(deviceId: String, peripheral: CBPeripheral) {
    self.deviceId = deviceId
    self.peripheral = peripheral
  }
}

private enum GattOperation {
  case read(CBUUID, Promise)
  case write(CBUUID, Data, CBCharacteristicWriteType, Promise)
  case notify(CBUUID, Bool, Promise)

  var promise: Promise {
    switch self {
    case .read(_, let promise): return promise
    case .write(_, _, _, let promise): return promise
    case .notify(_, _, let promise): return promise
    }
  }
}
