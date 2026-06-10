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

public class ExpoKBeaconProModule: Module, KBeaconsMgrDelegate, KBConnStateDelegate, KBNotifyDataDelegate {
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
      beacon.notifyDataDelegate = self
      pendingConnectionPromises.removeValue(forKey: macAddress)?.resolve(true)
      return
    }

    if state == .Disconnected || state == .ConnectTimeout {
      activeConnections.removeValue(forKey: macAddress)
      beacon.notifyDataDelegate = nil
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

  public func onNotifyData(_ beacon: KBeacon, type: KBNotifyDataType, data: Any) {
    let payload = notifyPayload(data)
    sendEvent("onNotifyDataReceived", [
      "macAddress": normalizedMac(beacon.mac()),
      "eventType": type.rawValue,
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
      beacon.notifyDataDelegate = nil
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

    AsyncFunction("readSensorDataInfo") { (macAddress: String, _: Int, promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }

      beacon.readSensorDataInfo { result, info, err in
        if result, let info {
          promise.resolve([
            "totalRecordNum": info.saveNum,
            "unreadRecordNum": info.unreadNum,
            "readIndex": info.readNextPos,
          ])
        } else {
          promise.reject("READ_FAILED", "Failed to read sensor data info. Error: \(err.rawValue)")
        }
      }
    }

    AsyncFunction("readSensorRecords") { (macAddress: String, request: [String: Any], promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      guard let maxRecords = request["maxRecords"] as? Int, maxRecords > 0 else {
        promise.reject("INVALID_ARGUMENT", "Invalid sensor record request")
        return
      }
      let sensorType = request["sensorType"] as? Int
      let readPosition = request["readPosition"] as? Int

      beacon.readSensorHistory(maxRecord: maxRecords) { result, records, err in
        if result {
          let recordDicts = (records ?? []).map { self.sensorRecordToDict($0, sensorType: sensorType) }
          promise.resolve([
            "nextReadPosition": (readPosition ?? 0) + recordDicts.count,
            "records": recordDicts,
          ])
        } else {
          promise.reject("READ_FAILED", "Failed to read sensor records. Error: \(err.rawValue)")
        }
      }
    }

    AsyncFunction("clearSensorHistory") { (macAddress: String, _: Int, promise: Promise) in
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }

      beacon.clearSensorHistoryData { result, err in
        if result {
          promise.resolve(true)
        } else {
          promise.reject("OPERATION_FAILED", "Failed to clear sensor history. Error: \(err.rawValue)")
        }
      }
    }

    AsyncFunction("subscribeNotify") { (macAddress: String, eventType: Int?, promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      beacon.notifyDataDelegate = self
      beacon.subscribeSensorDataNotify { result, err in
        if result {
          self.notificationSubscriptions.insert("\(normalized):\(eventType ?? 0)")
          promise.resolve(true)
        } else {
          promise.reject("SUBSCRIBE_FAILED", "Failed to subscribe to notifications. Error: \(err.rawValue)")
        }
      }
    }

    AsyncFunction("unsubscribeNotify") { (macAddress: String, eventType: Int?, promise: Promise) in
      let normalized = self.normalizedMac(macAddress)
      guard let beacon = self.connectedBeaconOrReject(macAddress, promise: promise) else { return }
      beacon.unsubscribeSensorDataNotify { result, err in
        if result {
          self.notificationSubscriptions.remove("\(normalized):\(eventType ?? 0)")
          promise.resolve(true)
        } else {
          promise.reject("UNSUBSCRIBE_FAILED", "Failed to unsubscribe from notifications. Error: \(err.rawValue)")
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
      beacon.notifyDataDelegate = nil
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

  private func deviceSnapshot(_ beacon: KBeacon) -> [String: Any] {
    [
      "macAddress": normalizedMac(beacon.mac()),
      "common": [
        "name": beacon.name(),
      ],
      "slots": [],
    ]
  }

  private func sensorRecordToDict(_ record: Any, sensorType: Int?) -> [String: Any?] {
    if let sensorRecord = record as? KBSensorDataMsg {
      return [
        "utcTime": sensorRecord.utcTime,
        "sensorType": sensorType as Any,
        "raw": sensorRecord.raw,
        "temperature": sensorRecord.temperature,
        "humidity": sensorRecord.humidity,
        "luxValue": sensorRecord.luxValue,
        "pirIndication": sensorRecord.pirIndication,
        "alarmStatus": sensorRecord.alarmStatus,
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

    if let sensorData = data as? KBSensorDataMsg {
      return (sensorData.raw, sensorRecordToDict(sensorData, sensorType: nil) as? [String: Any])
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
