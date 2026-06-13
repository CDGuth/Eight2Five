import CoreBluetooth
import ExpoModulesCore
import Foundation
import kbeaconlib2

private let defaultTimeoutMs = 15_000

private enum ConfigMappingError: Error {
  case invalid(index: Int)
}

public class ExpoKBeaconProModule: Module, KBeaconMgrDelegate, ConnStateDelegate, NotifyDataDelegate {
  private var beaconManager: KBeaconsMgr?
  private var discoveredBeacons = [String: KBeacon]()
  private var activeConnections = [String: KBeacon]()
  private var pendingConnectionPromises = [String: Promise]()
  private var pendingScanPromise: Promise?
  private var notificationSubscriptions = Set<String>()
  private var isDestroyed = false
  private var lastBluetoothState: BLECentralMgrState = .Unknown

  private func normalizedMac(_ mac: String) -> String {
    mac.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
  }

  private func validatedMac(_ mac: String) -> String? {
    let normalized = normalizedMac(mac)
    let pattern = #"^([0-9A-F]{2}:){5}[0-9A-F]{2}$"#
    return normalized.range(of: pattern, options: .regularExpression) == nil ? nil : normalized
  }

  private func normalizedPassword(_ password: String?) -> String {
    guard let password, !password.isEmpty else {
      return "0000000000000000"
    }

    return password
  }

  private func isValidPassword(_ password: String?) -> Bool {
    guard let password, !password.isEmpty else { return true }
    return password.count == 16
  }

  private func validatedTimeoutMs(_ timeoutMs: Int?) -> Int? {
    let resolvedTimeoutMs = timeoutMs ?? defaultTimeoutMs
    return resolvedTimeoutMs > 0 ? resolvedTimeoutMs : nil
  }

  private func normalizedTimeoutSeconds(_ timeoutMs: Int?) -> Double {
    let resolvedTimeoutMs = timeoutMs ?? defaultTimeoutMs
    return max(0.001, Double(resolvedTimeoutMs) / 1000.0)
  }

  private func connectionStateToJs(_ state: KBConnState) -> Int {
    switch state {
    case .Disconnected: return 0
    case .Connecting: return 1
    case .Connected: return 2
    case .Disconnecting: return 3
    }
  }

  private func connectionReasonToJs(_ evt: KBConnEvtReason) -> Int {
    switch evt {
    case .ConnNull: return 0
    case .ConnSuccess: return 256
    case .ConnTimeout: return 2
    case .ConnException: return 1
    case .ConnServiceNotSupport: return 6
    case .ConnManualDisconnting: return 7
    case .ConnAuthFail: return 3
    @unknown default: return 0
    }
  }

  private func normalizeHexString(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return value }
    let withoutPrefix = value
      .replacingOccurrences(of: "^0[xX]", with: "", options: .regularExpression)
    return "0x\(withoutPrefix.lowercased())"
  }

  private func beaconToDict(_ beacon: KBeacon, mac: String) -> [String: Any] {
    let packets = (beacon.allAdvPackets ?? []).map { advPacketToDict($0) }
    beacon.removeAdvPacket()

    let payload: [String: Any?] = [
      "deviceId": mac,
      "mac": mac,
      "name": beacon.name,
      "rssi": Int(beacon.rssi),
      "connectionState": connectionStateToJs(beacon.state),
      "advPackets": packets,
    ]

    return payload.filter { !isNil($0.value) }.mapValues { $0 as Any }
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
      dict["luxValue"] = sensorPacket.lightValue ?? optionalNumber(from: sensorPacket, selectorName: "luxLevel")
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

  // Compatibility shim for optional SDK accessors whose availability differs by pod patch level.
  // It checks selector support before invocation and never uses KVC for unknown keys.
  private func optionalNumber(from object: NSObject, selectorName: String) -> NSNumber? {
    let selector = NSSelectorFromString(selectorName)
    guard object.responds(to: selector) else { return nil }
    return object.perform(selector)?.takeUnretainedValue() as? NSNumber
  }

  private func setOptionalObject(_ value: Any?, on object: NSObject, selectorName: String) {
    guard let value else { return }
    let selector = NSSelectorFromString(selectorName)
    guard object.responds(to: selector) else { return }
    object.perform(selector, with: value)
  }

  private func numberValue(_ value: Any?) -> NSNumber? {
    if let number = value as? NSNumber {
      return number.doubleValue.isFinite ? number : nil
    }
    if let intValue = value as? Int {
      return NSNumber(value: intValue)
    }
    if let doubleValue = value as? Double, doubleValue.isFinite {
      return NSNumber(value: doubleValue)
    }
    return nil
  }

  private func integerValue(_ value: Any?) -> Int? {
    guard let number = numberValue(value) else { return nil }
    let doubleValue = number.doubleValue
    guard doubleValue.isFinite,
      doubleValue.rounded() == doubleValue,
      doubleValue >= Double(Int.min),
      doubleValue <= Double(Int.max)
    else { return nil }
    return number.intValue
  }

  private func integerNumber(_ value: Any?) -> NSNumber? {
    integerValue(value).map { NSNumber(value: $0) }
  }

  private func optionalIntegerNumber(_ dict: [String: Any], key: String, index: Int) throws -> NSNumber? {
    guard dict.keys.contains(key) else { return nil }
    guard let value = integerNumber(dict[key]) else { throw ConfigMappingError.invalid(index: index) }
    return value
  }

  private func optionalNumber(_ dict: [String: Any], key: String, index: Int) throws -> NSNumber? {
    guard dict.keys.contains(key) else { return nil }
    guard let value = numberValue(dict[key]) else { throw ConfigMappingError.invalid(index: index) }
    return value
  }

  private func optionalBoolNumber(_ dict: [String: Any], key: String, index: Int) throws -> NSNumber? {
    guard dict.keys.contains(key) else { return nil }
    guard let value = dict[key] as? Bool else { throw ConfigMappingError.invalid(index: index) }
    return NSNumber(value: value)
  }

  private func optionalString(_ dict: [String: Any], key: String, index: Int) throws -> String? {
    guard dict.keys.contains(key) else { return nil }
    guard let value = dict[key] as? String else { throw ConfigMappingError.invalid(index: index) }
    return value
  }

  private func dictToCfg(_ dict: [String: Any], index: Int) throws -> KBCfgBase {
    guard let configType = dict["configType"] as? String else {
      throw ConfigMappingError.invalid(index: index)
    }

    switch configType {
    case "common":
      let cfg = KBCfgCommon()
      let name = try optionalString(dict, key: "name", index: index)
      cfg.deviceName = name
      setOptionalObject(name, on: cfg, selectorName: "setName:")
      cfg.alwaysPowerOn = try optionalBoolNumber(dict, key: "alwaysPowerOn", index: index)
      cfg.password = try optionalString(dict, key: "password", index: index)
      cfg.refPower1Meters = try optionalIntegerNumber(dict, key: "refPower1Meters", index: index)
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
    guard let advType = integerValue(dict["advType"]) else {
      throw ConfigMappingError.invalid(index: index)
    }

    let cfg: KBCfgBase
    switch advType {
    case 0:
      let typed = KBCfgAdvIBeacon()
      typed.uuid = try optionalString(dict, key: "uuid", index: index)
      typed.majorID = try optionalIntegerNumber(dict, key: "majorID", index: index)
      typed.minorID = try optionalIntegerNumber(dict, key: "minorID", index: index)
      cfg = typed
    case 1:
      cfg = KBCfgAdvEddyTLM()
    case 2:
      let typed = KBCfgAdvEddyUID()
      typed.nid = normalizeHexString(try optionalString(dict, key: "nid", index: index))
      typed.sid = normalizeHexString(try optionalString(dict, key: "sid", index: index))
      cfg = typed
    case 3:
      let typed = KBCfgAdvEddyURL()
      typed.url = try optionalString(dict, key: "url", index: index)
      cfg = typed
    case 4:
      let typed = KBCfgAdvKSensor()
      typed.aesType = try optionalIntegerNumber(dict, key: "aesType", index: index)
      cfg = typed
    case 6:
      let typed = KBCfgAdvEBeacon()
      typed.uuid = try optionalString(dict, key: "uuid", index: index)
      typed.encryptInterval = try optionalIntegerNumber(dict, key: "encryptInterval", index: index)
      typed.aesType = try optionalIntegerNumber(dict, key: "aesType", index: index)
      cfg = typed
    case 255:
      cfg = KBCfgAdvNull()
    default:
      throw ConfigMappingError.invalid(index: index)
    }

    guard let slotIndex = integerValue(dict["slotIndex"]), slotIndex >= 0 else {
      throw ConfigMappingError.invalid(index: index)
    }
    try applySharedAdvertisementFields(dict, to: cfg, index: index)
    return cfg
  }

  private func applySharedAdvertisementFields(_ dict: [String: Any], to cfg: KBCfgBase, index: Int) throws {
    guard let advCfg = cfg as? KBCfgAdvBase else { return }
    advCfg.slotIndex = try optionalIntegerNumber(dict, key: "slotIndex", index: index)
    advCfg.txPower = try optionalIntegerNumber(dict, key: "txPower", index: index)
    advCfg.advPeriod = try optionalNumber(dict, key: "advPeriod", index: index)
    advCfg.advMode = try optionalIntegerNumber(dict, key: "advMode", index: index)
    advCfg.advTriggerOnly = try optionalBoolNumber(dict, key: "advTriggerOnly", index: index)
    advCfg.advConnectable = try optionalBoolNumber(dict, key: "advConnectable", index: index)
  }

  private func dictToTriggerCfg(_ dict: [String: Any], index: Int) throws -> KBCfgBase {
    guard let triggerType = integerValue(dict["triggerType"]) else {
      throw ConfigMappingError.invalid(index: index)
    }

    let cfg: KBCfgBase
    if triggerType == 5 {
      let typed = KBCfgTriggerMotion()
      typed.accODR = try optionalIntegerNumber(dict, key: "accODR", index: index)
      typed.wakeupDuration = try optionalIntegerNumber(dict, key: "wakeupDuration", index: index)
      cfg = typed
    } else if triggerType == 14 {
      let typed = KBCfgTriggerAngle()
      typed.aboveAngle = try optionalIntegerNumber(dict, key: "aboveAngle", index: index)
      typed.reportInterval = try optionalIntegerNumber(dict, key: "reportInterval", index: index)
      cfg = typed
    } else {
      cfg = KBCfgTrigger()
    }

    guard let triggerCfg = cfg as? KBCfgTrigger else { return cfg }
    triggerCfg.triggerIndex = try optionalIntegerNumber(dict, key: "triggerIndex", index: index)
    triggerCfg.triggerType = try optionalIntegerNumber(dict, key: "triggerType", index: index)
    triggerCfg.triggerAction = try optionalIntegerNumber(dict, key: "triggerAction", index: index)
    triggerCfg.triggerAdvSlot = try optionalIntegerNumber(dict, key: "triggerAdvSlot", index: index)
    triggerCfg.triggerAdvTime = try optionalIntegerNumber(dict, key: "triggerAdvTime", index: index)
    triggerCfg.triggerPara = try optionalIntegerNumber(dict, key: "triggerPara", index: index)
    triggerCfg.triggerAdvPeriod = try optionalIntegerNumber(dict, key: "triggerAdvPeriod", index: index)
    triggerCfg.triggerTxPower = try optionalIntegerNumber(dict, key: "triggerTxPower", index: index)
    triggerCfg.triggerAdvChangeMode = try optionalIntegerNumber(dict, key: "triggerAdvChangeMode", index: index)
    return cfg
  }

  private func dictToSensorCfg(_ dict: [String: Any], index: Int) throws -> KBCfgBase {
    guard let sensorType = integerValue(dict["sensorType"]) else {
      throw ConfigMappingError.invalid(index: index)
    }

    let cfg: KBCfgBase
    switch sensorType {
    case 1:
      let typed = KBCfgSensorHT()
      typed.logEnable = try optionalBoolNumber(dict, key: "logEnable", index: index)
      typed.sensorHtMeasureInterval = try optionalIntegerNumber(dict, key: "sensorHtMeasureInterval", index: index)
      typed.humidityChangeThreshold = try optionalIntegerNumber(dict, key: "humidityChangeThreshold", index: index)
      typed.temperatureChangeThreshold = try optionalIntegerNumber(dict, key: "temperatureChangeThreshold", index: index)
      cfg = typed
    case 2:
      let typed = KBCfgSensorPIR()
      typed.logEnable = try optionalBoolNumber(dict, key: "logEnable", index: index)
      typed.measureInterval = try optionalIntegerNumber(dict, key: "measureInterval", index: index)
      typed.logBackoffTime = try optionalIntegerNumber(dict, key: "logBackoffTime", index: index)
      cfg = typed
    case 3:
      let typed = KBCfgSensorLight()
      typed.logEnable = try optionalBoolNumber(dict, key: "logEnable", index: index)
      typed.measureInterval = try optionalIntegerNumber(dict, key: "measureInterval", index: index)
      typed.logChangeThreshold = try optionalIntegerNumber(dict, key: "logChangeThreshold", index: index)
      cfg = typed
    case 5:
      let typed = KBCfgSensorGEO()
      typed.parkingTag = try optionalBoolNumber(dict, key: "parkingTag", index: index)
      typed.parkingThreshold = try optionalIntegerNumber(dict, key: "parkingThreshold", index: index)
      typed.parkingDelay = try optionalIntegerNumber(dict, key: "parkingDelay", index: index)
      cfg = typed
    case 6:
      let typed = KBCfgSensorScan()
      typed.scanInterval = try optionalIntegerNumber(dict, key: "scanInterval", index: index)
      typed.motionScanInterval = try optionalIntegerNumber(dict, key: "motionScanInterval", index: index)
      typed.scanDuration = try optionalIntegerNumber(dict, key: "scanDuration", index: index)
      typed.scanModel = try optionalIntegerNumber(dict, key: "scanModel", index: index)
      typed.scanRssi = try optionalIntegerNumber(dict, key: "scanRssi", index: index)
      typed.scanChanelMask = try optionalIntegerNumber(dict, key: "scanChanelMask", index: index)
      typed.scanMax = try optionalIntegerNumber(dict, key: "scanMax", index: index)
      typed.scanResultAdvSlot = try optionalIntegerNumber(dict, key: "scanResultAdvSlot", index: index)
      cfg = typed
    default:
      throw ConfigMappingError.invalid(index: index)
    }

    (cfg as? KBCfgSensorBase)?.sensorType = NSNumber(value: sensorType)
    return cfg
  }

  public func onBeaconDiscovered(beacons: [KBeacon]) {
    let beaconData = beacons.compactMap { beacon -> [String: Any]? in
      guard let mac = beacon.mac else {
        sendEvent(
          "onError",
          [
            "code": "OPERATION_FAILED",
            "message": "Discovered KBeacon does not expose a MAC address",
          ]
        )
        return nil
      }

      let normalized = normalizedMac(mac)
      discoveredBeacons[normalized] = beacon
      return beaconToDict(beacon, mac: normalized)
    }
    sendEvent("onBeaconDiscovered", ["beacons": beaconData])
  }

  public func onCentralBleStateChange(newState: BLECentralMgrState) {
    lastBluetoothState = newState
    sendEvent("onBluetoothStateChanged", ["state": bluetoothStateString(newState)])
    settlePendingScanForBluetoothState(newState)
  }

  public func onConnStateChange(_ beacon: KBeacon, state: KBConnState, evt: KBConnEvtReason) {
    guard let mac = beacon.mac else {
      return
    }

    let macAddress = normalizedMac(mac)

    sendEvent("onConnectionStateChanged", [
      "macAddress": macAddress,
      "state": connectionStateToJs(state),
      "reason": connectionReasonToJs(evt),
    ])

    if state == .Connected {
      activeConnections[macAddress] = beacon
      pendingConnectionPromises.removeValue(forKey: macAddress)?.resolve(true)
      return
    }

    if state == .Disconnected {
      activeConnections.removeValue(forKey: macAddress)
      notificationSubscriptions = notificationSubscriptions.filter { !$0.hasPrefix("\(macAddress):") }

      guard let promise = pendingConnectionPromises.removeValue(forKey: macAddress) else {
        return
      }

      switch evt {
      case .ConnTimeout:
        promise.reject("CONNECTION_TIMEOUT", "Connection timed out")

      case .ConnAuthFail:
        promise.reject("AUTH_FAILED", "Beacon authentication failed")

      default:
        promise.reject("OPERATION_FAILED", "Connection failed with reason \(connectionReasonToJs(evt))")
      }
    }
  }

  public func onNotifyDataReceived(_ beacon: KBeacon, evt: Int, data: Data) {
    guard let mac = beacon.mac else {
      return
    }

    let payload = notifyPayload(data)
    sendEvent("onNotifyDataReceived", [
      "macAddress": normalizedMac(mac),
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
      self.beaconManager = KBeaconsMgr.sharedBeaconManager
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

      if self.lastBluetoothState == .Unknown {
        if self.pendingScanPromise != nil {
          promise.reject("SCAN_FAILED", "A scan start is already pending while Bluetooth initializes.")
          return
        }

        self.pendingScanPromise = promise
        return
      }

      if self.lastBluetoothState == .PowerOff {
        self.rejectAndEmit(promise, code: "BLUETOOTH_UNAVAILABLE", message: "Bluetooth is unavailable or powered off")
        return
      }

      if self.lastBluetoothState == .Unauthorized || self.bluetoothPermissionStatus() == "denied" {
        self.rejectAndEmit(promise, code: "PERMISSION_DENIED", message: "Bluetooth permission is denied")
        return
      }

      self.startScanningNow(manager: manager, promise: promise)
    }

    Function("stopScanning") {
      self.pendingScanPromise?.reject(
        "SCAN_CANCELLED",
        "Pending scan start was cancelled"
      )
      self.pendingScanPromise = nil
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
      guard let normalized = self.validatedMac(macAddress) else {
        promise.reject("INVALID_ARGUMENT", "macAddress must be a canonical colon-delimited MAC address")
        return
      }
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
      guard let normalized = self.validatedMac(macAddress) else {
        promise.reject("INVALID_ARGUMENT", "macAddress must be a canonical colon-delimited MAC address")
        return
      }
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
          promise.reject("CONFIG_FAILED", "Failed to modify config. Error: \(self.connectionReasonToJs(err))")
        }
      }
    }

    AsyncFunction("readDeviceSnapshot") { (macAddress: String, promise: Promise) in
      guard let normalized = self.validatedMac(macAddress) else {
        promise.reject("INVALID_ARGUMENT", "macAddress must be a canonical colon-delimited MAC address")
        return
      }
      guard let beacon = self.activeConnections[normalized] else {
        promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(normalized) is not connected")
        return
      }

      guard beacon.mac != nil else {
        promise.reject("READ_FAILED", "Connected KBeacon does not expose a MAC address")
        return
      }

      promise.resolve(self.deviceSnapshot(beacon))
    }

    AsyncFunction("readSensorDataInfo") { (macAddress: String, sensorType: Int, promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      guard self.isSupportedJsSensorType(sensorType) else {
        promise.reject("INVALID_ARGUMENT", "sensorType is invalid")
        return
      }

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
      guard let maxRecords = self.integerValue(request["maxRecords"]), maxRecords > 0 else {
        promise.reject("INVALID_ARGUMENT", "maxRecords must be a positive integer")
        return
      }
      guard let sensorType = self.integerValue(request["sensorType"]), self.isSupportedJsSensorType(sensorType) else {
        promise.reject("INVALID_ARGUMENT", "sensorType is invalid")
        return
      }

      guard
        let readOptionRaw = self.integerValue(request["readOption"]),
        let readOption = KBSensorReadOption(rawValue: readOptionRaw)
      else {
        promise.reject("INVALID_ARGUMENT", "readOption must be 0, 1, or 2")
        return
      }

      let nativeReadPosition: UInt32
      if request.keys.contains("readPosition") {
        guard let readPosition = self.integerValue(request["readPosition"]) else {
          promise.reject("INVALID_ARGUMENT", "readPosition must be between 0 and 4294967295")
          return
        }
        guard readPosition >= 0, UInt64(readPosition) <= UInt64(UInt32.max) else {
          promise.reject("INVALID_ARGUMENT", "readPosition must be between 0 and 4294967295")
          return
        }

        nativeReadPosition = UInt32(readPosition)
      } else {
        nativeReadPosition = KBRecordDataRsp.INVALID_DATA_RECORD_POS
      }

      beacon.readSensorRecord(
        self.nativeSensorType(sensorType),
        number: nativeReadPosition,
        option: readOption,
        max: maxRecords
      ) { result, response, err in
        guard result, let response else {
          promise.reject("READ_FAILED", "Failed to read sensor records. \(err?.errorDescription ?? "Unknown error")")
          return
        }

        let records = response.readDataRspList.map {
          self.sensorRecordToDict($0, sensorType: sensorType)
        }
        var payload: [String: Any] = ["records": records]

        if response.readDataNextPos != KBRecordDataRsp.INVALID_DATA_RECORD_POS {
          payload["nextReadPosition"] = response.readDataNextPos
        }

        promise.resolve(payload)
      }
    }

    AsyncFunction("clearSensorHistory") { (macAddress: String, sensorType: Int, promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      guard self.isSupportedJsSensorType(sensorType) else {
        promise.reject("INVALID_ARGUMENT", "sensorType is invalid")
        return
      }

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
      guard let eventType else {
        promise.reject("INVALID_ARGUMENT", "eventType is required")
        return
      }
      guard eventType >= 0 else {
        promise.reject("INVALID_ARGUMENT", "eventType must be a non-negative integer")
        return
      }

      beacon.subscribeSensorDataNotify(eventType, notifyDelegate: self) { result, err in
        if result {
          self.notificationSubscriptions.insert("\(normalized):\(eventType)")
          promise.resolve(true)
        } else {
          promise.reject("SUBSCRIBE_FAILED", "Failed to subscribe to notifications. \(err?.errorDescription ?? "Unknown error")")
        }
      }
    }

    AsyncFunction("unsubscribeNotify") { (macAddress: String, eventType: Int?, promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      guard let eventType else {
        promise.reject("INVALID_ARGUMENT", "eventType is required")
        return
      }
      guard eventType >= 0 else {
        promise.reject("INVALID_ARGUMENT", "eventType must be a non-negative integer")
        return
      }

      beacon.removeSubscribeSensorDataNotify(eventType) { result, err in
        if result {
          self.notificationSubscriptions.remove("\(normalized):\(eventType)")
          promise.resolve(true)
        } else {
          promise.reject("UNSUBSCRIBE_FAILED", "Failed to unsubscribe from notifications. \(err?.errorDescription ?? "Unknown error")")
        }
      }
    }
  }

  private func startScanningNow(manager: KBeaconsMgr, promise: Promise) {
    let started = manager.startScanning()
    guard started else {
      rejectAndEmit(promise, code: "SCAN_FAILED", message: "KBeacon scanning failed")
      return
    }

    promise.resolve(nil)
  }

  private func settlePendingScanForBluetoothState(_ state: BLECentralMgrState) {
    guard let promise = pendingScanPromise else { return }

    switch state {
    case .PowerOn:
      pendingScanPromise = nil
      guard let manager = beaconManager else {
        rejectAndEmit(promise, code: "BLUETOOTH_UNAVAILABLE", message: "KBeacon manager is unavailable")
        return
      }
      startScanningNow(manager: manager, promise: promise)

    case .Unauthorized:
      pendingScanPromise = nil
      rejectAndEmit(promise, code: "PERMISSION_DENIED", message: "Bluetooth permission is denied")

    case .PowerOff:
      pendingScanPromise = nil
      rejectAndEmit(promise, code: "BLUETOOTH_UNAVAILABLE", message: "Bluetooth is unavailable or powered off")

    case .Unknown:
      break
    }
  }

  private func connectInternal(
    macAddress: String,
    password: String?,
    timeoutMs: Int?,
    connParaMap: [String: Any]?,
    promise: Promise
  ) {
    guard let normalized = validatedMac(macAddress) else {
      promise.reject("INVALID_ARGUMENT", "macAddress must be a canonical colon-delimited MAC address")
      return
    }
    guard isValidPassword(password) else {
      promise.reject("INVALID_ARGUMENT", "password must be exactly 16 characters when provided")
      return
    }
    guard validatedTimeoutMs(timeoutMs) != nil else {
      promise.reject("INVALID_ARGUMENT", "timeoutMs must be a positive integer")
      return
    }
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

    let started: Bool
    if let connParaMap {
      let connPara = KBConnPara()
      if let syncUtcTime = connParaMap["syncUtcTime"] as? Bool { connPara.syncUtcTime = syncUtcTime }
      if let readCommPara = connParaMap["readCommPara"] as? Bool { connPara.readCommPara = readCommPara }
      if let readSlotPara = connParaMap["readSlotPara"] as? Bool { connPara.readSlotPara = readSlotPara }
      if let readTriggerPara = connParaMap["readTriggerPara"] as? Bool { connPara.readTriggerPara = readTriggerPara }
      if let readSensorPara = connParaMap["readSensorPara"] as? Bool { connPara.readSensorPara = readSensorPara }

      started = beacon.connectEnhanced(normalizedPassword(password), timeout: timeoutSeconds, connPara: connPara, delegate: self)
    } else {
      started = beacon.connect(normalizedPassword(password), timeout: timeoutSeconds, delegate: self)
    }

    if !started {
      pendingConnectionPromises.removeValue(forKey: normalized)
      promise.reject("OPERATION_FAILED", "Native connect request failed")
    }
  }

  private func connectedBeaconOrReject(_ macAddress: String, promise: Promise) -> KBeacon? {
    guard let normalized = validatedMac(macAddress) else {
      promise.reject("INVALID_ARGUMENT", "macAddress must be a canonical colon-delimited MAC address")
      return nil
    }
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
    return beaconManager?.beacons.values.first {
      guard let candidateMac = $0.mac else {
        return false
      }

      return normalizedMac(candidateMac) == normalized
    }
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
    pendingScanPromise?.reject("OPERATION_FAILED", "Module was destroyed")
    pendingScanPromise = nil

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
    if lastBluetoothState == .Unauthorized { return "denied" }

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

  private func bluetoothStateString(_ state: BLECentralMgrState) -> String {
    switch state {
    case .PowerOn:
      return "poweredOn"
    case .PowerOff:
      return "poweredOff"
    case .Unauthorized:
      return "unauthorized"
    case .Unknown:
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

  private func isSupportedJsSensorType(_ sensorType: Int) -> Bool {
    sensorType >= 1 && sensorType <= 7
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
    guard let mac = beacon.mac else {
      return [:]
    }

    var snapshot: [String: Any] = ["macAddress": normalizedMac(mac)]

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
    let dict: [String: Any?] = [
      "name": commonCfg.getName(),
      "model": commonCfg.getModel(),
      "version": commonCfg.getVersion(),
      "hardwareVersion": commonCfg.getHardwareVersion(),
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
    ]

    return dict.filter { !isNil($0.value) }.mapValues { $0 as Any }
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
