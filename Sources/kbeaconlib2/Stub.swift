// This file is editor-only. Real iOS builds use the CocoaPods kbeaconlib2 SDK.
// Do not use this stub as the source of truth for production API signatures.
// Keep signatures here limited to real CocoaPods APIs used by ExpoKBeaconProModule.swift.

@_exported import Foundation

public enum BLECentralMgrState: Int {
  case PowerOn = 0
  case PowerOff = 1
  case Unauthorized = 2
  case Unknown = 3
}

public protocol KBeaconMgrDelegate: NSObjectProtocol {
  func onBeaconDiscovered(beacons: [KBeacon])
  func onCentralBleStateChange(newState: BLECentralMgrState)
}

public protocol ConnStateDelegate: NSObjectProtocol {
  func onConnStateChange(_ beacon: KBeacon, state: KBConnState, evt: KBConnEvtReason)
}

public protocol NotifyDataDelegate: NSObjectProtocol {
  func onNotifyDataReceived(_ beacon: KBeacon, evt: Int, data: Data)
}

public enum KBConnState: Int {
  case Disconnected = 0
  case Connecting = 1
  case Disconnecting = 2
  case Connected = 3
}

public enum KBConnEvtReason: Int, Error {
  case ConnNull = 0
  case ConnSuccess = 1
  case ConnTimeout = 2
  case ConnException = 3
  case ConnServiceNotSupport = 4
  case ConnManualDisconnting = 5
  case ConnAuthFail = 6
}

public enum KBNotifyDataType: Int {
  case Sensor = 0
  case System = 1
  case Unknown = 255
}

public enum KBAdvType: Int {
  case IBeacon = 0
  case EddyTLM = 1
  case EddyUID = 2
  case EddyURL = 3
  case Sensor = 4
  case System = 5
  case EBeacon = 6
  case Unknown = 255
}

open class KBAdvPacketBase: NSObject {
  public let advType: KBAdvType
  public var uuid: String?
  public var majorID: NSNumber?
  public var minorID: NSNumber?
  public var advPeriod: NSNumber?
  public var txPower: NSNumber?
  public var rssi: NSNumber?

  public init(advType: KBAdvType = .Unknown) {
    self.advType = advType
  }

  public func getAdvType() -> Int { advType.rawValue }
}

public final class KBAdvPacketIBeacon: KBAdvPacketBase {}

public final class KBAdvPacketEddyTLM: KBAdvPacketBase {
  public var batteryLevel: NSNumber?
  public var temperature: NSNumber?
  public var advCount: NSNumber?
  public var secCount: NSNumber?
}

public final class KBAdvPacketEddyUID: KBAdvPacketBase {
  public var nid: String?
  public var sid: String?
}

public final class KBAdvPacketEddyURL: KBAdvPacketBase {
  public var url: String?
}

public final class KBAccSensorValue: NSObject {
  public var xAis: Int16 = 0
  public var yAis: Int16 = 0
  public var zAis: Int16 = 0
}

public class KBAdvPacketSensor: KBAdvPacketBase {
  public var temperature: NSNumber?
  public var humidity: NSNumber?
  public var batteryLevel: NSNumber?
  public var accSensor: KBAccSensorValue?
  public var cutoff: UInt8 = 0
  public var pirIndication: NSNumber?
  public var luxLevel: UInt16 = 0
}

public class KBAdvPacketSystem: KBAdvPacketBase {
  public var macAddress: String?
  public var model: String?
  public var batteryPercent: NSNumber?
  public var batteryLevel: NSNumber?
  public var version: String?
  public var firmwareVersion: String?
}

public class KBAdvPacketEBeacon: KBAdvPacketBase {
  public var mac: String?
  public var utcSecCount: NSNumber?
  public var measurePower: NSNumber?
}

open class KBCfgBase: NSObject {
  public override init() {}
}

open class KBCfgAdvBase: KBCfgBase {
  public var slotIndex: NSNumber?
  public var txPower: NSNumber?
  public var advPeriod: NSNumber?
  public var advMode: NSNumber?
  public var advTriggerOnly: NSNumber?
  public var advConnectable: NSNumber?

  public func getSlotIndex() -> Int { slotIndex?.intValue ?? 0 }
  public func getAdvType() -> Int { KBAdvType.Unknown.rawValue }
  public func getTxPower() -> Int { txPower?.intValue ?? 0 }
  public func getAdvPeriod() -> Float { advPeriod?.floatValue ?? 0 }
  public func getAdvMode() -> Int { advMode?.intValue ?? 0 }
  public func isAdvTriggerOnly() -> Bool { advTriggerOnly?.boolValue ?? false }
  public func isAdvConnectable() -> Bool { advConnectable?.boolValue ?? true }
  public func setSlotIndex(_ value: Int) -> Bool { slotIndex = NSNumber(value: value); return true }
  public func setTxPower(_ value: Int) -> Bool { txPower = NSNumber(value: value); return true }
  public func setAdvPeriod(_ value: Float) -> Bool { advPeriod = NSNumber(value: value); return true }
  public func setAdvMode(_ value: Int) -> Bool { advMode = NSNumber(value: value); return true }
  public func setAdvTriggerOnly(_ value: Bool) { advTriggerOnly = NSNumber(value: value) }
  public func setAdvConnectable(_ value: Bool) { advConnectable = NSNumber(value: value) }
}

public final class KBCfgCommon: KBCfgBase {
  public var deviceName: String?
  public var name: String?
  public var alwaysPowerOn: NSNumber?
  public var password: String?
  public var refPower1Meters: NSNumber?

  public func getName() -> String { deviceName ?? name ?? "" }
  public func getModel() -> String? { nil }
  public func getVersion() -> String? { nil }
  public func getHardwareVersion() -> String? { nil }
  public func getMaxSlot() -> Int { 5 }
  public func getMaxTrigger() -> Int { 5 }
  public func getMinTxPower() -> Int { -40 }
  public func getMaxTxPower() -> Int { 8 }
  public func isSupportIBeacon() -> Bool { true }
  public func isSupportEddyURL() -> Bool { true }
  public func isSupportEddyTLM() -> Bool { true }
  public func isSupportEddyUID() -> Bool { true }
  public func isSupportKBSensor() -> Bool { true }
  public func isSupportKBSystem() -> Bool { true }
  public func isSupportButton() -> Bool { false }
  public func isSupportBeep() -> Bool { false }
  public func isSupportAccSensor() -> Bool { false }
  public func isSupportHumiditySensor() -> Bool { false }
  public func isSupportPIRSensor() -> Bool { false }
  public func isSupportLightSensor() -> Bool { false }
  public func setName(_ value: String) -> Bool { deviceName = value; name = value; return true }
  public func setAlwaysPowerOn(_ value: Bool) { alwaysPowerOn = NSNumber(value: value) }
  public func setPassword(_ value: String) -> Bool { password = value; return true }
  public func setRefPower1Meters(_ value: Int) -> Bool { refPower1Meters = NSNumber(value: value); return true }
}

public final class KBCfgAdvIBeacon: KBCfgAdvBase {
  public var uuid: String?
  public var majorID: NSNumber?
  public var minorID: NSNumber?
  public override func getAdvType() -> Int { KBAdvType.IBeacon.rawValue }
  public func getUuid() -> String? { uuid }
  public func getMajorID() -> UInt { majorID?.uintValue ?? 0 }
  public func getMinorID() -> UInt { minorID?.uintValue ?? 0 }
  public func setUuid(_ value: String) -> Bool { uuid = value; return true }
  public func setMajorID(_ value: UInt) { majorID = NSNumber(value: value) }
  public func setMinorID(_ value: UInt) { minorID = NSNumber(value: value) }
}

public final class KBCfgAdvEddyUID: KBCfgAdvBase {
  public var nid: String?
  public var sid: String?
  public override func getAdvType() -> Int { KBAdvType.EddyUID.rawValue }
  public func getNid() -> String? { nid }
  public func getSid() -> String? { sid }
  public func setNid(_ value: String) -> Bool { nid = value; return true }
  public func setSid(_ value: String) -> Bool { sid = value; return true }
}

public final class KBCfgAdvEddyURL: KBCfgAdvBase {
  public var url: String?
  public override func getAdvType() -> Int { KBAdvType.EddyURL.rawValue }
  public func getUrl() -> String? { url }
  public func setUrl(_ value: String) -> Bool { url = value; return true }
}

public final class KBCfgAdvEddyTLM: KBCfgAdvBase {
  public override func getAdvType() -> Int { KBAdvType.EddyTLM.rawValue }
}

public final class KBCfgAdvKSensor: KBCfgAdvBase {
  public var aesType: NSNumber?
  public override func getAdvType() -> Int { KBAdvType.Sensor.rawValue }
  public func getAesType() -> Int { aesType?.intValue ?? 0 }
  public func setAesType(_ value: Int) { aesType = NSNumber(value: value) }
}

public final class KBCfgAdvEBeacon: KBCfgAdvBase {
  public var uuid: String?
  public var encryptInterval: NSNumber?
  public var aesType: NSNumber?
  public override func getAdvType() -> Int { KBAdvType.EBeacon.rawValue }
  public func getUuid() -> String? { uuid }
  public func getEncryptInterval() -> UInt8 { UInt8(encryptInterval?.intValue ?? 0) }
  public func getAESType() -> UInt8 { UInt8(aesType?.intValue ?? 0) }
  public func setUuid(_ value: String) -> Bool { uuid = value; return true }
  public func setEncryptInterval(_ value: UInt8) -> Bool { encryptInterval = NSNumber(value: value); return true }
  public func setAESType(_ value: UInt8) { aesType = NSNumber(value: value) }
}

public final class KBCfgAdvNull: KBCfgAdvBase {}

public class KBCfgTrigger: KBCfgBase {
  public var triggerIndex: NSNumber?
  public var triggerType: NSNumber?
  public var triggerAction: NSNumber?
  public var triggerAdvSlot: NSNumber?
  public var triggerAdvTime: NSNumber?
  public var triggerPara: NSNumber?
  public var triggerAdvPeriod: NSNumber?
  public var triggerTxPower: NSNumber?
  public var triggerAdvChangeMode: NSNumber?

  public func getTriggerIndex() -> Int { triggerIndex?.intValue ?? 0 }
  public func getTriggerType() -> Int { triggerType?.intValue ?? 0 }
  public func getTriggerAction() -> Int { triggerAction?.intValue ?? 0 }
  public func getTriggerAdvSlot() -> Int { triggerAdvSlot?.intValue ?? 0 }
  public func getTriggerAdvTime() -> Int { triggerAdvTime?.intValue ?? 0 }
  public func getTriggerPara() -> Int { triggerPara?.intValue ?? 0 }
  public func getTriggerAdvPeriod() -> Float { triggerAdvPeriod?.floatValue ?? 0 }
  public func getTriggerAdvTxPower() -> Int { triggerTxPower?.intValue ?? 0 }
  public func getTriggerAdvChgMode() -> Int { triggerAdvChangeMode?.intValue ?? 0 }
  public func setTriggerIndex(_ value: Int) { triggerIndex = NSNumber(value: value) }
  public func setTriggerType(_ value: Int) { triggerType = NSNumber(value: value) }
  public func setTriggerAction(_ value: Int) { triggerAction = NSNumber(value: value) }
  public func setTriggerAdvSlot(_ value: Int) -> Bool { triggerAdvSlot = NSNumber(value: value); return true }
  public func setTriggerAdvTime(_ value: Int) -> Bool { triggerAdvTime = NSNumber(value: value); return true }
  public func setTriggerPara(_ value: Int) { triggerPara = NSNumber(value: value) }
  public func setTriggerAdvPeriod(_ value: Float) -> Bool { triggerAdvPeriod = NSNumber(value: value); return true }
  public func setTriggerAdvTxPower(_ value: Int) -> Bool { triggerTxPower = NSNumber(value: value); return true }
  public func setTriggerAdvChangeMode(_ value: Int) { triggerAdvChangeMode = NSNumber(value: value) }
}

public final class KBCfgTriggerMotion: KBCfgTrigger {
  public var accODR: NSNumber?
  public var wakeupDuration: NSNumber?
  public func getAccODR() -> Int { accODR?.intValue ?? 0 }
  public func getWakeupDuration() -> Int { wakeupDuration?.intValue ?? 0 }
  public func setAccODR(_ value: Int) -> Bool { accODR = NSNumber(value: value); return true }
  public func setWakeupDuration(_ value: Int) -> Bool { wakeupDuration = NSNumber(value: value); return true }
}

public final class KBCfgTriggerAngle: KBCfgTrigger {
  public var aboveAngle: NSNumber?
  public var reportInterval: NSNumber?
  public func getAboveAngle() -> Int? { aboveAngle?.intValue }
  public func getReportingInterval() -> Int? { reportInterval?.intValue }
  public func setAboveAngle(_ value: Int) { aboveAngle = NSNumber(value: value) }
  public func setReportingInterval(_ value: Int) { reportInterval = NSNumber(value: value) }
}

open class KBCfgSensorBase: KBCfgBase {
  public var sensorType: NSNumber?
  public func getSensorType() -> Int { sensorType?.intValue ?? 0 }
  public func setSensorType(_ value: Int) { sensorType = NSNumber(value: value) }
}

public final class KBCfgSensorHT: KBCfgSensorBase {
  public var logEnable: NSNumber?
  public var sensorHtMeasureInterval: NSNumber?
  public var humidityChangeThreshold: NSNumber?
  public var temperatureChangeThreshold: NSNumber?
  public func getLogEnable() -> Bool { logEnable?.boolValue ?? false }
  public func getMeasureInterval() -> Int { sensorHtMeasureInterval?.intValue ?? 0 }
  public func getHumidityLogThreshold() -> Int { humidityChangeThreshold?.intValue ?? 0 }
  public func getTemperatureLogThreshold() -> Int { temperatureChangeThreshold?.intValue ?? 0 }
  public func setLogEnable(_ value: Bool) { logEnable = NSNumber(value: value) }
  public func setMeasureInterval(_ value: Int) -> Bool { sensorHtMeasureInterval = NSNumber(value: value); return true }
  public func setHumidityLogThreshold(_ value: Int) -> Bool { humidityChangeThreshold = NSNumber(value: value); return true }
  public func setTemperatureLogThreshold(_ value: Int) -> Bool { temperatureChangeThreshold = NSNumber(value: value); return true }
}

public final class KBCfgSensorLight: KBCfgSensorBase {
  public var logEnable: NSNumber?
  public var measureInterval: NSNumber?
  public var logChangeThreshold: NSNumber?
  public func getLogEnable() -> Bool { logEnable?.boolValue ?? false }
  public func getMeasureInterval() -> Int { measureInterval?.intValue ?? 0 }
  public func getLogChangeThreshold() -> Int { logChangeThreshold?.intValue ?? 0 }
  public func setLogEnable(_ value: Bool) { logEnable = NSNumber(value: value) }
  public func setMeasureInterval(_ value: Int) -> Bool { measureInterval = NSNumber(value: value); return true }
  public func setLogChangeThreshold(_ value: Int) { logChangeThreshold = NSNumber(value: value) }
}

public final class KBCfgSensorGEO: KBCfgSensorBase {
  public var parkingTag: NSNumber?
  public var parkingThreshold: NSNumber?
  public var parkingDelay: NSNumber?
  public func isParkingTaged() -> Bool { parkingTag?.boolValue ?? false }
  public func getParkingThreshold() -> Int { parkingThreshold?.intValue ?? 0 }
  public func getPakingDelay() -> Int { parkingDelay?.intValue ?? 0 }
  public func setParkingTag(_ value: Bool) { parkingTag = NSNumber(value: value) }
  public func setParkingThreshold(_ value: Int) -> Bool { parkingThreshold = NSNumber(value: value); return true }
  public func setParkingDelay(_ value: Int) -> Bool { parkingDelay = NSNumber(value: value); return true }
}

public final class KBCfgSensorScan: KBCfgSensorBase {
  public var scanInterval: NSNumber?
  public var motionScanInterval: NSNumber?
  public var scanDuration: NSNumber?
  public var scanModel: NSNumber?
  public var scanRssi: NSNumber?
  public var scanChanelMask: NSNumber?
  public var scanMax: NSNumber?
  public var scanResultAdvSlot: NSNumber?
  public func getScanInterval() -> Int { scanInterval?.intValue ?? 0 }
  public func getMotionScanInterval() -> Int { motionScanInterval?.intValue ?? 0 }
  public func getScanDuration() -> Int { scanDuration?.intValue ?? 0 }
  public func getScanModel() -> Int { scanModel?.intValue ?? 0 }
  public func getScanRssi() -> Int { scanRssi?.intValue ?? 0 }
  public func getScanChanelMask() -> UInt8 { UInt8(scanChanelMask?.intValue ?? 0) }
  public func getScanMax() -> Int { scanMax?.intValue ?? 0 }
  public func getScanResultAdvSlot() -> Int { scanResultAdvSlot?.intValue ?? 0 }
  public func setScanInterval(_ value: Int) -> Bool { scanInterval = NSNumber(value: value); return true }
  public func setMotionScanInterval(_ value: Int) -> Bool { motionScanInterval = NSNumber(value: value); return true }
  public func setScanDuration(_ value: Int) -> Bool { scanDuration = NSNumber(value: value); return true }
  public func setScanModel(_ value: Int) -> Bool { scanModel = NSNumber(value: value); return true }
  public func setScanRssi(_ value: Int) -> Bool { scanRssi = NSNumber(value: value); return true }
  public func setScanChanelMask(_ value: UInt8) -> Bool { scanChanelMask = NSNumber(value: value); return true }
  public func setScanMax(_ value: Int) -> Bool { scanMax = NSNumber(value: value); return true }
  public func setScanResultAdvSlot(_ value: Int) { scanResultAdvSlot = NSNumber(value: value) }
}

public final class KBCfgSensorPIR: KBCfgSensorBase {
  public var logEnable: NSNumber?
  public var measureInterval: NSNumber?
  public var logBackoffTime: NSNumber?
  public func getLogEnable() -> Bool { logEnable?.boolValue ?? false }
  public func getMeasureInterval() -> Int { measureInterval?.intValue ?? 0 }
  public func getLogBackoffTime() -> Int { logBackoffTime?.intValue ?? 0 }
  public func setLogEnable(_ value: Bool) { logEnable = NSNumber(value: value) }
  public func setMeasureInterval(_ value: Int) -> Bool { measureInterval = NSNumber(value: value); return true }
  public func setLogBackoffTime(_ value: Int) -> Bool { logBackoffTime = NSNumber(value: value); return true }
}

public final class KBSensorType: NSObject {
  public static let HTHumidity = 0x2
  public static let PIR = 0x10
  public static let Light = 0x20
  public static let VOC = 0x40
  public static let GEO = 0x42
  public static let SCAN = 0x44
  public static let Alarm = 0x8
}

public enum KBSensorReadOption: Int {
  case NormalOrder = 0
  case ReverseOrder = 1
  case NewRecord = 2
}

public final class KBException: NSObject {
  public var errorCode: Int
  public var errorDescription: String

  public init(_ errorCode: Int = 0, desc: String = "") {
    self.errorCode = errorCode
    self.errorDescription = desc
  }
}

public final class KBRecordInfoRsp: NSObject {
  public var sensorType: Int?
  public var totalRecordNumber: UInt32 = 0
  public var unreadRecordNumber: UInt32 = 0
  public var readInfoUtcSeconds: UInt64?
}

public final class KBRecordDataRsp: NSObject {
  public static let INVALID_DATA_RECORD_POS: UInt32 = 4_294_967_295
  public var readDataNextPos: UInt32 = INVALID_DATA_RECORD_POS
  public var readDataRspList: [NSObject] = []
}

open class KBRecordBase: NSObject {}

public final class KBRecordHumidity: KBRecordBase {
  public var utcTime: UInt32 = 0
  public var temperature: Float = 0
  public var humidity: Float = 0
}

public final class KBRecordLight: KBRecordBase {
  public var utcTime: UInt32 = 0
  public var lightLevel: UInt16 = 0
}

public final class KBRecordPIR: KBRecordBase {
  public var utcTime: UInt32 = 0
  public var pirIndication: UInt8 = 0
}

public final class KBRecordAlarm: KBRecordBase {
  public var utcTime: UInt32 = 0
  public var alarmStatus: UInt8 = 0
}

public final class KBConnPara {
  public var syncUtcTime = false
  public var readCommPara = false
  public var readSlotPara = false
  public var readTriggerPara = false
  public var readSensorPara = false
  public var timeout: Float

  public init() {
    self.timeout = 15.0
  }

  public init(timeout: Float) {
    self.timeout = timeout
  }
}

public class KBeacon: NSObject {
  public weak var delegate: ConnStateDelegate?
  public var mac: String?
  public var name: String?
  public var rssi: Int8 = -60
  public var state: KBConnState = .Disconnected
  public var allAdvPackets: [KBAdvPacketBase]?

  public init(mac: String? = "00:00:00:00:00:00", name: String? = "Beacon", rssi: Int8 = -60) {
    self.mac = mac
    self.name = name
    self.rssi = rssi
  }

  public func removeAdvPacket() { allAdvPackets?.removeAll() }

  public func connect(_ password: String, timeout: Double, delegate: ConnStateDelegate?) -> Bool {
    _ = password
    _ = timeout
    self.delegate = delegate
    state = .Connected
    delegate?.onConnStateChange(self, state: state, evt: .ConnSuccess)
    return true
  }

  public func connectEnhanced(_ password: String, timeout: Double, connPara: KBConnPara, delegate: ConnStateDelegate?) -> Bool {
    _ = password
    _ = timeout
    _ = connPara
    self.delegate = delegate
    state = .Connected
    delegate?.onConnStateChange(self, state: state, evt: .ConnSuccess)
    return true
  }

  public func disconnect() {
    state = .Disconnected
  }

  public func modifyConfig(array: [KBCfgBase], callback: @escaping (Bool, KBException?) -> Void) {
    _ = array
    callback(true, nil)
  }

  public func getCommonCfg() -> KBCfgCommon? { KBCfgCommon() }

  public func getSlotCfgList() -> [KBCfgAdvBase]? { [] }

  public func getTriggerCfgList() -> [KBCfgTrigger]? { [] }

  public func getSensorCfgList() -> [KBCfgSensorBase]? { [] }

  public func readSensorDataInfo(_ sensorType: Int, callback: @escaping (Bool, KBRecordInfoRsp?, KBException?) -> Void) {
    _ = sensorType
    callback(true, KBRecordInfoRsp(), nil)
  }

  public func readSensorRecord(_ sensorType: Int, number: UInt32, option: KBSensorReadOption, max: Int, callback: @escaping (Bool, KBRecordDataRsp?, KBException?) -> Void) {
    _ = sensorType
    _ = number
    _ = option
    _ = max
    callback(true, KBRecordDataRsp(), nil)
  }

  public func clearSensorRecord(_ sensorType: Int, callback: @escaping (Bool, Data?, KBException?) -> Void) {
    _ = sensorType
    callback(true, nil, nil)
  }

  public func subscribeSensorDataNotify(_ triggerType: Int, notifyDelegate: NotifyDataDelegate, callback: @escaping (Bool, KBException?) -> Void) {
    _ = triggerType
    _ = notifyDelegate
    callback(true, nil)
  }

  public func removeSubscribeSensorDataNotify(_ triggerType: Int, callback: @escaping (Bool, KBException?) -> Void) {
    _ = triggerType
    callback(true, nil)
  }
}

public final class KBeaconsMgr {
  public static let sharedBeaconManager = KBeaconsMgr()

  public weak var delegate: KBeaconMgrDelegate?
  public var beacons: [String: KBeacon] = [:]

  public func startScanning() -> Bool {
    true
  }

  public func stopScanning() {}

  public func clearBeacons() {
    beacons.removeAll()
  }
}
