// Editor-only kbeaconlib2 stubs for SourceKit-LSP on non-macOS platforms.
// Real iOS builds link the CocoaPods kbeaconlib2 dependency.
// This file only provides enough API shape for local type-checking and navigation.

@_exported import Foundation
import CoreBluetooth

public protocol KBeaconsMgrDelegate: AnyObject {
  func onBeaconDiscovered(_ beacons: [KBeacon])
  func onCentralBleStateChange(_ state: CBCentralManagerState)
}

public protocol KBConnStateDelegate: AnyObject {
  func onConnStateChange(_ beacon: KBeacon, state: KBConnState, err: KBConnErr)
}

public protocol KBNotifyDataDelegate: AnyObject {
  func onNotifyData(_ beacon: KBeacon, type: KBNotifyDataType, data: Any)
}

public enum KBConnState: Int {
  case Disconnected = 0
  case Connecting = 1
  case Connected = 2
  case Disconnecting = 3
  case ConnectTimeout = 4
}

public enum KBConnErr: Int, Error {
  case Success = 0
  case Failed = 1
  case Timeout = 2
  case AuthFailed = 3
}

public enum KBeaconErr: Int {
  case Success = 0
  case BLESystem = 1
  case Permission = 2
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

public class KBAdvPacketSensor: KBAdvPacketBase {
  public var temperature: NSNumber?
  public var humidity: NSNumber?
  public var batteryLevel: NSNumber?
  public var alarmStatus: NSNumber?
  public var pirIndication: NSNumber?
  public var accX: NSNumber?
  public var accY: NSNumber?
  public var accZ: NSNumber?
  public var lightValue: NSNumber?
  public var luxLevel: NSNumber?
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
  public var uuidValue: String?
  public var utcSecCount: NSNumber?
  public var refTxPower: NSNumber?
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
}

public final class KBCfgCommon: KBCfgBase {
  public var deviceName: String?
  public var name: String?
  public var alwaysPowerOn: NSNumber?
  public var password: String?
  public var refPower1Meters: NSNumber?
}

public final class KBCfgAdvIBeacon: KBCfgAdvBase {
  public var uuid: String?
  public var majorID: NSNumber?
  public var minorID: NSNumber?
}

public final class KBCfgAdvEddyUID: KBCfgAdvBase {
  public var nid: String?
  public var sid: String?
}

public final class KBCfgAdvEddyURL: KBCfgAdvBase {
  public var url: String?
}

public final class KBCfgAdvEddyTLM: KBCfgAdvBase {}

public final class KBCfgAdvKSensor: KBCfgAdvBase {
  public var aesType: NSNumber?
}

public final class KBCfgAdvEBeacon: KBCfgAdvBase {
  public var uuid: String?
  public var encryptInterval: NSNumber?
  public var aesType: NSNumber?
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
}

public final class KBCfgTriggerMotion: KBCfgTrigger {
  public var accODR: NSNumber?
  public var wakeupDuration: NSNumber?
}

public final class KBCfgTriggerAngle: KBCfgTrigger {
  public var aboveAngle: NSNumber?
  public var reportInterval: NSNumber?
}

public final class KBCfgSensorHT: KBCfgBase {
  public var sensorType: NSNumber?
  public var logEnable: NSNumber?
  public var sensorHtMeasureInterval: NSNumber?
  public var humidityChangeThreshold: NSNumber?
  public var temperatureChangeThreshold: NSNumber?
}

public final class KBCfgSensorLight: KBCfgBase {
  public var sensorType: NSNumber?
  public var logEnable: NSNumber?
  public var measureInterval: NSNumber?
  public var logChangeThreshold: NSNumber?
}

public final class KBCfgSensorGEO: KBCfgBase {
  public var sensorType: NSNumber?
  public var parkingTag: NSNumber?
  public var parkingThreshold: NSNumber?
  public var parkingDelay: NSNumber?
}

public final class KBCfgSensorScan: KBCfgBase {
  public var sensorType: NSNumber?
  public var scanInterval: NSNumber?
  public var motionScanInterval: NSNumber?
  public var scanDuration: NSNumber?
  public var scanModel: NSNumber?
  public var scanRssi: NSNumber?
  public var scanChanelMask: NSNumber?
  public var scanMax: NSNumber?
  public var scanResultAdvSlot: NSNumber?
}

public final class KBCfgSensorPIR: KBCfgBase {
  public var sensorType: NSNumber?
  public var logEnable: NSNumber?
  public var measureInterval: NSNumber?
  public var logBackoffTime: NSNumber?
}

public final class KBSensorDataInfo {
  public var readNextPos = 0
  public var saveNum = 0
  public var unreadNum = 0
  public init() {}
}

public final class KBSensorDataMsg {
  public var utcTime = 0
  public var raw: [Int]?
  public var temperature: NSNumber?
  public var humidity: NSNumber?
  public var luxValue: NSNumber?
  public var pirIndication: NSNumber?
  public var alarmStatus: NSNumber?
  public init() {}
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

public class KBeacon {
  private let macAddress: String
  private let deviceName: String
  private var signal: Int
  private var connectable: Bool
  private var state: KBConnState = .Disconnected

  public init(mac: String = "00:00:00:00:00:00", name: String = "Beacon", rssi: Int = -60, connectable: Bool = true) {
    self.macAddress = mac
    self.deviceName = name
    self.signal = rssi
    self.connectable = connectable
  }

  public var advPacket: KBAdvPacketBase?
  public var allAdvPackets: [KBAdvPacketBase] = []
  public weak var notifyDataDelegate: KBNotifyDataDelegate?

  public func mac() -> String { macAddress }
  public func name() -> String { deviceName }
  public func rssi() -> Int { signal }
  public func isConnectable() -> Bool { connectable }
  public func connectionState() -> KBConnState { state }
  public func removeAdvPacket() { allAdvPackets.removeAll() }

  public func connect(_ password: String, timeout: Float, delegate: KBConnStateDelegate?) {
    _ = password
    _ = timeout
    state = .Connected
    delegate?.onConnStateChange(self, state: state, err: .Success)
  }

  public func connectEnhanced(_ password: String, timeout: Float, connPara: KBConnPara, delegate: KBConnStateDelegate?) {
    _ = password
    _ = timeout
    _ = connPara
    state = .Connected
    delegate?.onConnStateChange(self, state: state, err: .Success)
  }

  public func disconnect() {
    state = .Disconnected
  }

  public func modifyConfig(obj: [KBCfgBase], callback: @escaping (Bool, Int, KBConnErr) -> Void) {
    _ = obj
    callback(true, 0, .Success)
  }

  public func readSensorDataInfo(_ completion: @escaping (Bool, KBSensorDataInfo?, KBConnErr) -> Void) {
    completion(true, KBSensorDataInfo(), .Success)
  }

  public func readSensorHistory(maxRecord: Int, completion: @escaping (Bool, [Any]?, KBConnErr) -> Void) {
    _ = maxRecord
    completion(true, [], .Success)
  }

  public func clearSensorHistoryData(_ completion: @escaping (Bool, KBConnErr) -> Void) {
    completion(true, .Success)
  }

  public func subscribeSensorDataNotify(_ completion: @escaping (Bool, KBConnErr) -> Void) {
    completion(true, .Success)
  }

  public func unsubscribeSensorDataNotify(_ completion: @escaping (Bool, KBConnErr) -> Void) {
    completion(true, .Success)
  }
}

public final class KBeaconsMgr {
  public static func sharedBeaconManager() -> KBeaconsMgr {
    KBeaconsMgr()
  }

  public weak var delegate: KBeaconsMgrDelegate?
  public var beacons: [KBeacon] = []

  public func startScanning() -> Int {
    KBeaconErr.Success.rawValue
  }

  public func stopScanning() {}

  public func clearBeacons() {
    beacons.removeAll()
  }

  public func release() {}
}
