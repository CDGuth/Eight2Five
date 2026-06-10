import CoreBluetooth
import ExpoModulesCore
import Foundation
import kbeaconlib2

private let defaultTimeoutMs = 15_000
private let connectionReasonTimeout = 2
private let connectionReasonAuthFailed = 3

private enum ConfigMappingError: Error {
  case invalid(index: Int)
}

public class ExpoKBeaconProModule: Module, KBeaconsMgrDelegate, KBConnStateDelegate, NotifyDataDelegate {
  private var beaconManager: KBeaconsMgr?
  private var discoveredBeacons = [String: KBeacon]()
  private var activeConnections = [String: KBeacon]()
  private var pendingConnectionPromises = [String: Promise]()
  private var notificationSubscriptions = Set<String>()
  private var isDestroyed = false
  private var lastBluetoothState: CBCentralManagerState = .unknown

  private func normalizedMac(_ mac: String) -> String {
    mac.uppercased()
  }

  private func normalizedPassword(_ password: String?) -> String {
    guard let password, !password.isEmpty else {
      return "0000000000000000"
    }

    return password
  }

  private func normalizedTimeoutSeconds(_ timeoutMs: Int?) -> Float {
    let resolvedTimeoutMs = timeoutMs ?? defaultTimeoutMs
    return max(0.001, Float(resolvedTimeoutMs) / 1000.0)
  }

  private func normalizeHexString(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return value }
    let withoutPrefix = value
      .replacingOccurrences(of: "^0[xX]", with: "", options: .regularExpression)
    return "0x\(withoutPrefix.lowercased())"
  }

  private func beaconToDict(_ beacon: KBeacon) -> [String: Any?] {
    let mac = normalizedMac(beacon.mac())
    let packets = beacon.allAdvPackets.map { advPacketToDict($0) }
    beacon.removeAdvPacket()

    return [
      "deviceId": mac,
      "mac": mac,
      "name": beacon.name(),
      "rssi": beacon.rssi(),
      "isConnectable": beacon.isConnectable(),
      "connectionState": beacon.connectionState().rawValue,
      "advPackets": packets,
    ]
  }

  private func advPacketToDict(_ advPacket: KBAdvPacketBase) -> [String: Any?] {
    var dict: [String: Any?] = [
      "advType": advPacket.advType.rawValue,
    ]

    if let iBeaconPacket = advPacket as? KBAdvPacketIBeacon {
      dict["uuid"] = iBeaconPacket.uuid
      dict["majorID"] = iBeaconPacket.majorID
      dict["minorID"] = iBeaconPacket.minorID
    } else if let eddyTlmPacket = advPacket as? KBAdvPacketEddyTLM {
      dict["batteryLevel"] = eddyTlmPacket.batteryLevel
      dict["temperature"] = eddyTlmPacket.temperature
      dict["advCount"] = eddyTlmPacket.advCount
      dict["secCount"] = eddyTlmPacket.secCount
    } else if let eddyUIDPacket = advPacket as? KBAdvPacketEddyUID {
      dict["nid"] = normalizeHexString(eddyUIDPacket.nid)
      dict["sid"] = normalizeHexString(eddyUIDPacket.sid)
    } else if let eddyURLPacket = advPacket as? KBAdvPacketEddyURL {
      dict["url"] = eddyURLPacket.url
    } else if let sensorPacket = advPacket as? KBAdvPacketSensor {
      dict["batteryLevel"] = sensorPacket.batteryLevel
      dict["temperature"] = sensorPacket.temperature
      dict["humidity"] = sensorPacket.humidity
      if let accX = sensorPacket.accX, let accY = sensorPacket.accY, let accZ = sensorPacket.accZ {
        dict["accSensor"] = [
          "xAis": accX,
          "yAis": accY,
          "zAis": accZ,
        ]
      }
      dict["alarmStatus"] = sensorPacket.alarmStatus
      dict["pirIndication"] = sensorPacket.pirIndication
      dict["luxValue"] = sensorPacket.lightValue ?? value(forKey: "luxLevel", on: sensorPacket)
    } else if let systemPacket = advPacket as? KBAdvPacketSystem {
      dict["macAddress"] = systemPacket.macAddress.map(normalizedMac)
      dict["model"] = systemPacket.model
      dict["batteryPercent"] = systemPacket.batteryPercent ?? systemPacket.batteryLevel
      dict["version"] = systemPacket.firmwareVersion ?? systemPacket.version
    } else if let eBeaconPacket = advPacket as? KBAdvPacketEBeacon {
      dict["mac"] = eBeaconPacket.mac.map(normalizedMac)
      dict["uuid"] = eBeaconPacket.uuid
      dict["utcSecCount"] = eBeaconPacket.utcSecCount
      dict["refTxPower"] = eBeaconPacket.refTxPower ?? eBeaconPacket.measurePower
    } else {
      dict["advType"] = 255
      dict["raw"] = ["className": String(describing: type(of: advPacket))]
    }

    return dict.filter { !isNil($0.value) }
  }

  private func isNil(_ value: Any?) -> Bool {
    if case Optional<Any>.none = value { return true }
    return false
  }

  private func value(forKey key: String, on object: AnyObject) -> Any? {
    (object as? NSObject)?.value(forKey: key)
  }

  private func setValue(_ value: Any?, forKey key: String, on object: AnyObject) {
    guard let value, let object = object as? NSObject else { return }
    object.setValue(value, forKey: key)
  }

  private func setNumber(_ value: Any?, forKey key: String, on object: AnyObject) {
    if let number = value as? NSNumber {
      setValue(number, forKey: key, on: object)
    } else if let intValue = value as? Int {
      setValue(NSNumber(value: intValue), forKey: key, on: object)
    } else if let doubleValue = value as? Double {
      setValue(NSNumber(value: doubleValue), forKey: key, on: object)
    }
  }

  private func dictToCfg(_ dict: [String: Any], index: Int) throws -> KBCfgBase {
    guard let configType = dict["configType"] as? String else {
      throw ConfigMappingError.invalid(index: index)
    }

    switch configType {
    case "common":
      let cfg = KBCfgCommon()
      setValue(dict["name"] as? String, forKey: "deviceName", on: cfg)
      setValue(dict["name"] as? String, forKey: "name", on: cfg)
      setValue(dict["alwaysPowerOn"], forKey: "alwaysPowerOn", on: cfg)
      setValue(dict["password"] as? String, forKey: "password", on: cfg)
      setNumber(dict["refPower1Meters"], forKey: "refPower1Meters", on: cfg)
      return cfg

    case "advertisement":
      return try dictToAdvertisementCfg(dict, index: index)

    case "trigger":
      return try dictToTriggerCfg(dict, index: index)

    case "sensor":
      return try dictToSensorCfg(dict, index: index)

    default:
      throw ConfigMappingError.invalid(index: index)
    }
  }

  private func dictToAdvertisementCfg(_ dict: [String: Any], index: Int) throws -> KBCfgBase {
    guard let advType = dict["advType"] as? Int else {
      throw ConfigMappingError.invalid(index: index)
    }

    let cfg: KBCfgBase
    switch advType {
    case 0:
      let typed = KBCfgAdvIBeacon()
      setValue(dict["uuid"] as? String, forKey: "uuid", on: typed)
      setNumber(dict["majorID"], forKey: "majorID", on: typed)
      setNumber(dict["minorID"], forKey: "minorID", on: typed)
      cfg = typed
    case 1:
      cfg = KBCfgAdvEddyTLM()
    case 2:
      let typed = KBCfgAdvEddyUID()
      setValue(normalizeHexString(dict["nid"] as? String), forKey: "nid", on: typed)
      setValue(normalizeHexString(dict["sid"] as? String), forKey: "sid", on: typed)
      cfg = typed
    case 3:
      let typed = KBCfgAdvEddyURL()
      setValue(dict["url"] as? String, forKey: "url", on: typed)
      cfg = typed
    case 4:
      let typed = KBCfgAdvKSensor()
      setNumber(dict["aesType"], forKey: "aesType", on: typed)
      cfg = typed
    case 6:
      let typed = KBCfgAdvEBeacon()
      setValue(dict["uuid"] as? String, forKey: "uuid", on: typed)
      setNumber(dict["encryptInterval"], forKey: "encryptInterval", on: typed)
      setNumber(dict["aesType"], forKey: "aesType", on: typed)
      cfg = typed
    case 255:
      cfg = KBCfgAdvNull()
    default:
      throw ConfigMappingError.invalid(index: index)
    }

    guard dict["slotIndex"] is Int || dict["slotIndex"] is NSNumber else {
      throw ConfigMappingError.invalid(index: index)
    }
    applySharedAdvertisementFields(dict, to: cfg)
    return cfg
  }

  private func applySharedAdvertisementFields(_ dict: [String: Any], to cfg: KBCfgBase) {
    setNumber(dict["slotIndex"], forKey: "slotIndex", on: cfg)
    setNumber(dict["txPower"], forKey: "txPower", on: cfg)
    setNumber(dict["advPeriod"], forKey: "advPeriod", on: cfg)
    setNumber(dict["advMode"], forKey: "advMode", on: cfg)
    setValue(dict["advTriggerOnly"], forKey: "advTriggerOnly", on: cfg)
    setValue(dict["advConnectable"], forKey: "advConnectable", on: cfg)
  }

  private func dictToTriggerCfg(_ dict: [String: Any], index: Int) throws -> KBCfgBase {
    guard let triggerType = dict["triggerType"] as? Int else {
      throw ConfigMappingError.invalid(index: index)
    }

    let cfg: KBCfgBase
    if triggerType == 5 {
      cfg = KBCfgTriggerMotion()
      setNumber(dict["accODR"], forKey: "accODR", on: cfg)
      setNumber(dict["wakeupDuration"], forKey: "wakeupDuration", on: cfg)
    } else if triggerType == 14 {
      cfg = KBCfgTriggerAngle()
      setNumber(dict["aboveAngle"], forKey: "aboveAngle", on: cfg)
      setNumber(dict["reportInterval"], forKey: "reportInterval", on: cfg)
    } else {
      cfg = KBCfgTrigger()
    }

    setNumber(dict["triggerIndex"], forKey: "triggerIndex", on: cfg)
    setNumber(dict["triggerType"], forKey: "triggerType", on: cfg)
    setNumber(dict["triggerAction"], forKey: "triggerAction", on: cfg)
    setNumber(dict["triggerAdvSlot"], forKey: "triggerAdvSlot", on: cfg)
    setNumber(dict["triggerAdvTime"], forKey: "triggerAdvTime", on: cfg)
    setNumber(dict["triggerPara"], forKey: "triggerPara", on: cfg)
    setNumber(dict["triggerAdvPeriod"], forKey: "triggerAdvPeriod", on: cfg)
    setNumber(dict["triggerTxPower"], forKey: "triggerTxPower", on: cfg)
    setNumber(dict["triggerAdvChangeMode"], forKey: "triggerAdvChangeMode", on: cfg)
    return cfg
  }

  private func dictToSensorCfg(_ dict: [String: Any], index: Int) throws -> KBCfgBase {
    guard let sensorType = dict["sensorType"] as? Int else {
      throw ConfigMappingError.invalid(index: index)
    }

    let cfg: KBCfgBase
    switch sensorType {
    case 1:
      cfg = KBCfgSensorHT()
      setValue(dict["logEnable"], forKey: "logEnable", on: cfg)
      setNumber(dict["sensorHtMeasureInterval"], forKey: "sensorHtMeasureInterval", on: cfg)
      setNumber(dict["humidityChangeThreshold"], forKey: "humidityChangeThreshold", on: cfg)
      setNumber(dict["temperatureChangeThreshold"], forKey: "temperatureChangeThreshold", on: cfg)
    case 2:
      cfg = KBCfgSensorPIR()
      setValue(dict["logEnable"], forKey: "logEnable", on: cfg)
      setNumber(dict["measureInterval"], forKey: "measureInterval", on: cfg)
      setNumber(dict["logBackoffTime"], forKey: "logBackoffTime", on: cfg)
    case 3:
      cfg = KBCfgSensorLight()
      setValue(dict["logEnable"], forKey: "logEnable", on: cfg)
      setNumber(dict["measureInterval"], forKey: "measureInterval", on: cfg)
      setNumber(dict["logChangeThreshold"], forKey: "logChangeThreshold", on: cfg)
    case 5:
      cfg = KBCfgSensorGEO()
      setValue(dict["parkingTag"], forKey: "parkingTag", on: cfg)
      setNumber(dict["parkingThreshold"], forKey: "parkingThreshold", on: cfg)
      setNumber(dict["parkingDelay"], forKey: "parkingDelay", on: cfg)
    case 6:
      cfg = KBCfgSensorScan()
      setNumber(dict["scanInterval"], forKey: "scanInterval", on: cfg)
      setNumber(dict["motionScanInterval"], forKey: "motionScanInterval", on: cfg)
      setNumber(dict["scanDuration"], forKey: "scanDuration", on: cfg)
      setNumber(dict["scanModel"], forKey: "scanModel", on: cfg)
      setNumber(dict["scanRssi"], forKey: "scanRssi", on: cfg)
      setNumber(dict["scanChanelMask"], forKey: "scanChanelMask", on: cfg)
      setNumber(dict["scanMax"], forKey: "scanMax", on: cfg)
      setNumber(dict["scanResultAdvSlot"], forKey: "scanResultAdvSlot", on: cfg)
    default:
      throw ConfigMappingError.invalid(index: index)
    }

    setNumber(sensorType, forKey: "sensorType", on: cfg)
    return cfg
  }

  public func onBeaconDiscovered(_ beacons: [KBeacon]) {
    let beaconData = beacons.map { beacon -> [String: Any?] in
      let mac = normalizedMac(beacon.mac())
      discoveredBeacons[mac] = beacon
      return beaconToDict(beacon)
    }
    sendEvent("onBeaconDiscovered", ["beacons": beaconData])
  }

  public func onCentralBleStateChange(_ state: CBCentralManagerState) {
    lastBluetoothState = state
    sendEvent("onBluetoothStateChanged", ["state": bluetoothStateString(state)])
  }

  public func onConnStateChange(_ beacon: KBeacon, state: KBConnState, err: KBConnErr) {
    let macAddress = normalizedMac(beacon.mac())

    sendEvent("onConnectionStateChanged", [
      "macAddress": macAddress,
      "state": state.rawValue,
      "reason": err.rawValue,
    ])

    if state == .Connected {
      activeConnections[macAddress] = beacon
      pendingConnectionPromises.removeValue(forKey: macAddress)?.resolve(true)
      return
    }

    if state == .Disconnected || state == .ConnectTimeout {
      activeConnections.removeValue(forKey: macAddress)
      notificationSubscriptions = notificationSubscriptions.filter { !$0.hasPrefix("\(macAddress):") }

      guard let promise = pendingConnectionPromises.removeValue(forKey: macAddress) else {
        return
      }

      if state == .ConnectTimeout || err.rawValue == connectionReasonTimeout {
        promise.reject("CONNECTION_TIMEOUT", "Connection timed out")
      } else if err.rawValue == connectionReasonAuthFailed {
        promise.reject("AUTH_FAILED", "Beacon authentication failed")
      } else {
        promise.reject("OPERATION_FAILED", "Connection failed with reason \(err.rawValue)")
      }
    }
  }

  public func onNotifyDataReceived(_ beacon: KBeacon, evt: Int, data: Data) {
    let payload = notifyPayload(data)
    sendEvent("onNotifyDataReceived", [
      "macAddress": normalizedMac(beacon.mac()),
      "eventType": evt,
      "raw": payload.raw as Any,
      "data": payload.data as Any,
    ])
  }

  @ModuleDefinitionBuilder
  public func definition() -> ModuleDefinition {
    Name("ExpoKBeaconPro")

    Events(
      "onBeaconDiscovered",
      "onConnectionStateChanged",
      "onNotifyDataReceived",
      "onBluetoothStateChanged",
      "onError"
    )

    OnCreate {
      self.isDestroyed = false
      self.beaconManager = KBeaconsMgr.sharedBeaconManager()
      self.beaconManager?.delegate = self
    }

    OnDestroy {
      self.cleanupModule()
    }

    AsyncFunction("startScanning") { (promise: Promise) in
      guard let manager = self.beaconManager else {
        self.rejectAndEmit(promise, code: "BLUETOOTH_UNAVAILABLE", message: "KBeacon manager is unavailable")
        return
      }

      if self.lastBluetoothState == .unsupported || self.lastBluetoothState == .poweredOff {
        self.rejectAndEmit(promise, code: "BLUETOOTH_UNAVAILABLE", message: "Bluetooth is unavailable or powered off")
        return
      }

      if self.lastBluetoothState == .unauthorized || self.bluetoothPermissionStatus() == "denied" {
        self.rejectAndEmit(promise, code: "PERMISSION_DENIED", message: "Bluetooth permission is denied")
        return
      }

      let result = manager.startScanning()
      if result != KBeaconErr.Success.rawValue {
        self.rejectAndEmit(promise, code: "SCAN_FAILED", message: "KBeacon scanning failed with code \(result)")
        return
      }

      promise.resolve(nil)
    }

    Function("stopScanning") {
      self.beaconManager?.stopScanning()
    }

    Function("clearBeacons") {
      self.beaconManager?.clearBeacons()
      self.discoveredBeacons.removeAll()
    }

    Function("getCapabilities") {
      self.capabilitiesMap()
    }

    Function("getPermissionStatus") {
      self.currentPermissionStatus()
    }

    AsyncFunction("requestPermissions") { (promise: Promise) in
      promise.resolve(self.currentPermissionStatus())
    }

    AsyncFunction("connect") { (macAddress: String, password: String?, timeoutMs: Int?, promise: Promise) in
      self.connectInternal(macAddress: macAddress, password: password, timeoutMs: timeoutMs, connParaMap: nil, promise: promise)
    }

    AsyncFunction("connectEnhanced") { (macAddress: String, password: String?, timeoutMs: Int?, connParaMap: [String: Any]?, promise: Promise) in
      self.connectInternal(macAddress: macAddress, password: password, timeoutMs: timeoutMs, connParaMap: connParaMap, promise: promise)
    }

    AsyncFunction("disconnect") { (macAddress: String, promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.activeConnections.removeValue(forKey: normalized) ?? self.findBeacon(mac: macAddress) else {
        promise.resolve(false)
        return
      }

      self.pendingConnectionPromises.removeValue(forKey: normalized)?.reject("OPERATION_FAILED", "Connection was cancelled by disconnect")
      self.notificationSubscriptions = self.notificationSubscriptions.filter { !$0.hasPrefix("\(normalized):") }
      beacon.disconnect()
      promise.resolve(true)
    }

    AsyncFunction("modifyConfig") { (macAddress: String, configs: [[String: Any]], promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.activeConnections[normalized] else {
        promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(normalized) is not connected")
        return
      }

      guard !configs.isEmpty else {
        promise.reject("INVALID_CONFIG", "configs must be a non-empty array")
        return
      }

      var cfgObjects = [KBCfgBase]()
      do {
        for (index, config) in configs.enumerated() {
          cfgObjects.append(try self.dictToCfg(config, index: index))
        }
      } catch ConfigMappingError.invalid(let index) {
        promise.reject("INVALID_CONFIG", "configuration at index \(index) is unsupported or malformed")
        return
      } catch {
        promise.reject("INVALID_CONFIG", "Invalid configuration objects provided")
        return
      }

      beacon.modifyConfig(obj: cfgObjects) { result, _, err in
        if result {
          promise.resolve(true)
        } else {
          promise.reject("CONFIG_FAILED", "Failed to modify config. Error: \(err.rawValue)")
        }
      }
    }

    AsyncFunction("readDeviceSnapshot") { (macAddress: String, promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.activeConnections[normalized] else {
        promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(normalized) is not connected")
        return
      }

      promise.resolve(self.deviceSnapshot(beacon))
    }

    AsyncFunction("readSensorDataInfo") { (macAddress: String, sensorType: Int, promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }

      beacon.readSensorDataInfo(self.nativeSensorType(sensorType)) { result, info, err in
        if result, let info {
          promise.resolve([
            "totalRecordNum": info.totalRecordNumber,
            "unreadRecordNum": info.unreadRecordNumber,
          ])
        } else {
          promise.reject("READ_FAILED", "Failed to read sensor data info. \(err?.errorDescription ?? "Unknown error")")
        }
      }
    }

    AsyncFunction("readSensorRecords") { (macAddress: String, request: [String: Any], promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      guard let maxRecords = request["maxRecords"] as? Int, maxRecords > 0 else {
        promise.reject("INVALID_ARGUMENT", "Invalid sensor record request")
        return
      }
      guard let sensorType = request["sensorType"] as? Int else {
        promise.reject("INVALID_ARGUMENT", "Invalid sensor record request")
        return
      }
      let readPosition = request["readPosition"] as? Int ?? 0

      guard readPosition >= 0 else {
        promise.reject("INVALID_ARGUMENT", "readPosition must be non-negative")
        return
      }

      let nativeReadPosition = UInt32(readPosition)

      beacon.readSensorRecord(
        self.nativeSensorType(sensorType),
        number: nativeReadPosition,
        option: KBSensorReadOption.NormalOrder,
        max: maxRecords
      ) { result, recordRsp, err in
        if result {
          let records = recordRsp?.readDataRspList ?? []
          let recordDicts = records.map { self.sensorRecordToDict($0, sensorType: sensorType) }
          promise.resolve([
            "records": recordDicts,
          ])
        } else {
          promise.reject("READ_FAILED", "Failed to read sensor records. \(err?.errorDescription ?? "Unknown error")")
        }
      }
    }

    AsyncFunction("clearSensorHistory") { (macAddress: String, sensorType: Int, promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }

      beacon.clearSensorRecord(self.nativeSensorType(sensorType)) { result, _, err in
        if result {
          promise.resolve(true)
        } else {
          promise.reject("OPERATION_FAILED", "Failed to clear sensor history. \(err?.errorDescription ?? "Unknown error")")
        }
      }
    }

    AsyncFunction("subscribeNotify") { (macAddress: String, eventType: Int?, promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      let notifyEventType = eventType ?? 0
      beacon.subscribeSensorDataNotify(notifyEventType, notifyDelegate: self) { result, err in
        if result {
          self.notificationSubscriptions.insert("\(normalized):\(notifyEventType)")
          promise.resolve(true)
        } else {
          promise.reject("SUBSCRIBE_FAILED", "Failed to subscribe to notifications. \(err?.errorDescription ?? "Unknown error")")
        }
      }
    }

    AsyncFunction("unsubscribeNotify") { (macAddress: String, eventType: Int?, promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      let notifyEventType = eventType ?? 0
      beacon.removeSubscribeSensorDataNotify(notifyEventType) { result, err in
        if result {
          self.notificationSubscriptions.remove("\(normalized):\(notifyEventType)")
          promise.resolve(true)
        } else {
          promise.reject("UNSUBSCRIBE_FAILED", "Failed to unsubscribe from notifications. \(err?.errorDescription ?? "Unknown error")")
        }
      }
    }
  }

  private func connectInternal(
    macAddress: String,
    password: String?,
    timeoutMs: Int?,
    connParaMap: [String: Any]?,
    promise: Promise
  ) {
    let normalized = normalizedMac(macAddress)
    guard !isDestroyed else {
      promise.reject("OPERATION_FAILED", "Module has been destroyed")
      return
    }

    if activeConnections[normalized] != nil {
      promise.resolve(true)
      return
    }

    if pendingConnectionPromises[normalized] != nil {
      promise.reject("CONNECTION_BUSY", "Connection already pending for \(normalized)")
      return
    }

    guard let beacon = findBeacon(mac: macAddress) else {
      promise.reject("BEACON_NOT_FOUND", "Beacon with MAC \(normalized) was not discovered")
      return
    }

    let timeoutSeconds = normalizedTimeoutSeconds(timeoutMs)
    pendingConnectionPromises[normalized] = promise

    if let connParaMap {
      let connPara = KBConnPara()
      if let syncUtcTime = connParaMap["syncUtcTime"] as? Bool { connPara.syncUtcTime = syncUtcTime }
      if let readCommPara = connParaMap["readCommPara"] as? Bool { connPara.readCommPara = readCommPara }
      if let readSlotPara = connParaMap["readSlotPara"] as? Bool { connPara.readSlotPara = readSlotPara }
      if let readTriggerPara = connParaMap["readTriggerPara"] as? Bool { connPara.readTriggerPara = readTriggerPara }
      if let readSensorPara = connParaMap["readSensorPara"] as? Bool { connPara.readSensorPara = readSensorPara }

      beacon.connectEnhanced(normalizedPassword(password), timeout: timeoutSeconds, connPara: connPara, delegate: self)
      return
    }

    beacon.connect(normalizedPassword(password), timeout: timeoutSeconds, delegate: self)
  }

  private func connectedBeaconOrReject(_ macAddress: String, promise: Promise) -> KBeacon? {
    let normalized = normalizedMac(macAddress)
    guard let beacon = activeConnections[normalized] else {
      promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(normalized) is not connected")
      return nil
    }

    return beacon
  }

  private func findBeacon(mac: String) -> KBeacon? {
    let normalized = normalizedMac(mac)
    if let activeBeacon = activeConnections[normalized] { return activeBeacon }
    if let discoveredBeacon = discoveredBeacons[normalized] { return discoveredBeacon }
    return beaconManager?.beacons.first(where: { normalizedMac($0.mac()) == normalized })
  }

  private func cleanupModule() {
    isDestroyed = true
    beaconManager?.stopScanning()
    beaconManager?.clearBeacons()
    beaconManager?.delegate = nil

    activeConnections.values.forEach { beacon in
      beacon.disconnect()
    }

    pendingConnectionPromises.values.forEach { promise in
      promise.reject("OPERATION_FAILED", "Module was destroyed")
    }

    activeConnections.removeAll()
    discoveredBeacons.removeAll()
    pendingConnectionPromises.removeAll()
    notificationSubscriptions.removeAll()
    beaconManager = nil
  }

  private func currentPermissionStatus() -> [String: Any] {
    [
      "bluetooth": bluetoothPermissionStatus(),
      "canAskAgain": bluetoothPermissionStatus() == "undetermined",
    ]
  }

  private func bluetoothPermissionStatus() -> String {
    if lastBluetoothState == .unsupported { return "unavailable" }

    if #available(iOS 13.1, *) {
      switch CBManager.authorization {
      case .allowedAlways:
        return "granted"
      case .denied, .restricted:
        return "denied"
      case .notDetermined:
        return "undetermined"
      @unknown default:
        return "undetermined"
      }
    }

    return "undetermined"
  }

  private func bluetoothStateString(_ state: CBCentralManagerState) -> String {
    switch state {
    case .unknown:
      return "unknown"
    case .resetting:
      return "resetting"
    case .unsupported:
      return "unsupported"
    case .unauthorized:
      return "unauthorized"
    case .poweredOff:
      return "poweredOff"
    case .poweredOn:
      return "poweredOn"
    @unknown default:
      return "unknown"
    }
  }

  private func capabilitiesMap() -> [String: Any] {
    [
      "transport": "ble",
      "supportsScanning": true,
      "supportsConnection": true,
      "supportsConfiguration": true,
      "supportsEnhancedConnection": true,
      "supportsSensorHistory": true,
      "supportsNotifications": true,
      "supportsDfu": false,
    ]
  }

  private func nativeSensorType(_ sensorType: Int) -> Int {
    switch sensorType {
    case 1: return KBSensorType.HTHumidity
    case 2: return KBSensorType.PIR
    case 3: return KBSensorType.Light
    case 4: return KBSensorType.VOC
    case 5: return KBSensorType.GEO
    case 6: return KBSensorType.SCAN
    case 7: return KBSensorType.Alarm
    default: return sensorType
    }
  }

  private func deviceSnapshot(_ beacon: KBeacon) -> [String: Any] {
    var snapshot: [String: Any] = ["macAddress": normalizedMac(beacon.mac())]

    if let commonCfg = beacon.getCommonCfg() {
      snapshot["common"] = commonConfigToDict(commonCfg)
    }

    if let slotCfgList = beacon.getSlotCfgList() {
      snapshot["slots"] = slotCfgList.map(slotConfigToDict)
    }

    if let triggerCfgList = beacon.getTriggerCfgList() {
      snapshot["triggers"] = triggerCfgList.map(triggerConfigToDict)
    }

    if let sensorCfgList = beacon.getSensorCfgList() {
      snapshot["sensors"] = sensorCfgList.map(sensorConfigToDict)
    }

    return snapshot
  }

  private func commonConfigToDict(_ commonCfg: KBCfgCommon) -> [String: Any] {
    [
      "name": commonCfg.getName() as Any,
      "model": commonCfg.getModel() as Any,
      "version": commonCfg.getVersion() as Any,
      "hardwareVersion": commonCfg.getHardwareVersion() as Any,
      "maxSlots": commonCfg.getMaxSlot(),
      "maxTriggers": commonCfg.getMaxTrigger(),
      "minTxPower": commonCfg.getMinTxPower(),
      "maxTxPower": commonCfg.getMaxTxPower(),
      "supportsIBeacon": commonCfg.isSupportIBeacon(),
      "supportsEddyUid": commonCfg.isSupportEddyUID(),
      "supportsEddyUrl": commonCfg.isSupportEddyURL(),
      "supportsEddyTlm": commonCfg.isSupportEddyTLM(),
      "supportsSensorAdvertisement": commonCfg.isSupportKBSensor(),
      "supportsSystemAdvertisement": commonCfg.isSupportKBSystem(),
      "supportsButton": commonCfg.isSupportButton(),
      "supportsBeep": commonCfg.isSupportBeep(),
      "supportsAccelerometer": commonCfg.isSupportAccSensor(),
      "supportsHumidity": commonCfg.isSupportHumiditySensor(),
      "supportsPir": commonCfg.isSupportPIRSensor(),
      "supportsLight": commonCfg.isSupportLightSensor(),
    ].filter { !isNil($0.value) }
  }

  private func slotConfigToDict(_ slotCfg: KBCfgAdvBase) -> [String: Any] {
    var dict: [String: Any?] = [
      "configType": "advertisement",
      "slotIndex": slotCfg.getSlotIndex(),
      "advType": slotCfg.getAdvType(),
      "txPower": slotCfg.getTxPower(),
      "advPeriod": slotCfg.getAdvPeriod(),
      "advMode": slotCfg.getAdvMode(),
      "advTriggerOnly": slotCfg.isAdvTriggerOnly(),
      "advConnectable": slotCfg.isAdvConnectable(),
    ]

    if let iBeaconCfg = slotCfg as? KBCfgAdvIBeacon {
      dict["uuid"] = iBeaconCfg.getUuid()
      dict["majorID"] = iBeaconCfg.getMajorID()
      dict["minorID"] = iBeaconCfg.getMinorID()
    } else if let uidCfg = slotCfg as? KBCfgAdvEddyUID {
      dict["nid"] = normalizeHexString(uidCfg.getNid())
      dict["sid"] = normalizeHexString(uidCfg.getSid())
    } else if let urlCfg = slotCfg as? KBCfgAdvEddyURL {
      dict["url"] = urlCfg.getUrl()
    } else if let sensorCfg = slotCfg as? KBCfgAdvKSensor {
      dict["aesType"] = sensorCfg.getAesType()
    } else if let eBeaconCfg = slotCfg as? KBCfgAdvEBeacon {
      dict["uuid"] = eBeaconCfg.getUuid()
      dict["encryptInterval"] = eBeaconCfg.getEncryptInterval()
      dict["aesType"] = eBeaconCfg.getAESType()
    }

    return dict.filter { !isNil($0.value) }.mapValues { $0 as Any }
  }

  private func triggerConfigToDict(_ triggerCfg: KBCfgTrigger) -> [String: Any] {
    var dict: [String: Any?] = [
      "configType": "trigger",
      "triggerIndex": triggerCfg.getTriggerIndex(),
      "triggerType": triggerCfg.getTriggerType(),
      "triggerAction": triggerCfg.getTriggerAction(),
      "triggerAdvSlot": triggerCfg.getTriggerAdvSlot(),
      "triggerAdvTime": triggerCfg.getTriggerAdvTime(),
      "triggerPara": triggerCfg.getTriggerPara(),
      "triggerAdvPeriod": triggerCfg.getTriggerAdvPeriod(),
      "triggerTxPower": triggerCfg.getTriggerAdvTxPower(),
      "triggerAdvChangeMode": triggerCfg.getTriggerAdvChangeMode(),
    ]

    if let motionCfg = triggerCfg as? KBCfgTriggerMotion {
      dict["accODR"] = motionCfg.getAccODR()
      dict["wakeupDuration"] = motionCfg.getWakeupDuration()
    } else if let angleCfg = triggerCfg as? KBCfgTriggerAngle {
      dict["aboveAngle"] = angleCfg.getAboveAngle()
      dict["reportInterval"] = angleCfg.getReportingInterval()
    }

    return dict.filter { !isNil($0.value) }.mapValues { $0 as Any }
  }

  private func sensorConfigToDict(_ sensorCfg: KBCfgSensorBase) -> [String: Any] {
    var dict: [String: Any?] = [
      "configType": "sensor",
      "sensorType": sensorCfg.getSensorType(),
    ]

    if let htCfg = sensorCfg as? KBCfgSensorHT {
      dict["logEnable"] = htCfg.getLogEnable()
      dict["sensorHtMeasureInterval"] = htCfg.getMeasureInterval()
      dict["humidityChangeThreshold"] = htCfg.getHumidityLogThreshold()
      dict["temperatureChangeThreshold"] = htCfg.getTemperatureLogThreshold()
    } else if let lightCfg = sensorCfg as? KBCfgSensorLight {
      dict["logEnable"] = lightCfg.getLogEnable()
      dict["measureInterval"] = lightCfg.getMeasureInterval()
      dict["logChangeThreshold"] = lightCfg.getLogChangeThreshold()
    } else if let geoCfg = sensorCfg as? KBCfgSensorGEO {
      dict["parkingTag"] = geoCfg.isParkingTaged()
      dict["parkingThreshold"] = geoCfg.getParkingThreshold()
      dict["parkingDelay"] = geoCfg.getParkingDelay()
    } else if let scanCfg = sensorCfg as? KBCfgSensorScan {
      dict["scanInterval"] = scanCfg.getScanInterval()
      dict["motionScanInterval"] = scanCfg.getMotionScanInterval()
      dict["scanDuration"] = scanCfg.getScanDuration()
      dict["scanModel"] = scanCfg.getScanModel()
      dict["scanRssi"] = scanCfg.getScanRssi()
      dict["scanChanelMask"] = scanCfg.getScanChanelMask()
      dict["scanMax"] = scanCfg.getScanMax()
      dict["scanResultAdvSlot"] = scanCfg.getScanResultAdvSlot()
    } else if let pirCfg = sensorCfg as? KBCfgSensorPIR {
      dict["logEnable"] = pirCfg.getLogEnable()
      dict["measureInterval"] = pirCfg.getMeasureInterval()
      dict["logBackoffTime"] = pirCfg.getLogBackoffTime()
    }

    return dict.filter { !isNil($0.value) }.mapValues { $0 as Any }
  }

  private func sensorRecordToDict(_ record: Any, sensorType: Int?) -> [String: Any?] {
    if let humidityRecord = record as? KBRecordHumidity {
      return [
        "utcTime": humidityRecord.utcTime,
        "sensorType": sensorType as Any,
        "temperature": humidityRecord.temperature,
        "humidity": humidityRecord.humidity,
      ].filter { !isNil($0.value) }
    }

    if let lightRecord = record as? KBRecordLight {
      return [
        "utcTime": lightRecord.utcTime,
        "sensorType": sensorType as Any,
        "luxValue": lightRecord.lightLevel,
      ].filter { !isNil($0.value) }
    }

    if let pirRecord = record as? KBRecordPIR {
      return [
        "utcTime": pirRecord.utcTime,
        "sensorType": sensorType as Any,
        "pirIndication": pirRecord.pirIndication,
      ].filter { !isNil($0.value) }
    }

    if let alarmRecord = record as? KBRecordAlarm {
      return [
        "utcTime": alarmRecord.utcTime,
        "sensorType": sensorType as Any,
        "alarmStatus": alarmRecord.alarmStatus,
      ].filter { !isNil($0.value) }
    }

    if let data = record as? Data {
      return ["utcTime": 0, "sensorType": sensorType as Any, "raw": data.map(Int.init)]
    }

    return ["utcTime": 0, "sensorType": sensorType as Any]
  }

  private func notifyPayload(_ data: Any) -> (raw: [Int]?, data: [String: Any]?) {
    if let byteData = data as? Data {
      return (byteData.map(Int.init), nil)
    }

    if let byteArray = data as? [UInt8] {
      return (byteArray.map(Int.init), nil)
    }

    if let numberArray = data as? [NSNumber] {
      return (numberArray.map { $0.intValue }, nil)
    }

    if let dict = data as? [String: Any] {
      return (nil, dict)
    }

    return (nil, nil)
  }

  private func rejectAndEmit(_ promise: Promise, code: String, message: String, macAddress: String? = nil) {
    var payload: [String: Any] = [
      "code": code,
      "message": message,
    ]
    if let macAddress { payload["macAddress"] = normalizedMac(macAddress) }
    sendEvent("onError", payload)
    promise.reject(code, message)
  }
}
