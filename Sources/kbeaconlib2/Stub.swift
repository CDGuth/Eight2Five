// Editor-only kbeaconlib2 stubs for SourceKit-LSP on non-macOS platforms.
// Real iOS builds link the CocoaPods kbeaconlib2 dependency.
// This file only provides enough API shape for local type-checking and navigation.

// Re-export Foundation so NSNumber and related symbols are visible to consumers.
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
  case Connected = 1
  case ConnectTimeout = 2
}

public enum KBConnErr: Int, Error {
  case Success = 0
  case Failed = 1
}

public enum KBeaconErr: Int {
  case Success = 0
  case BLESystem = 1
}

public enum KBNotifyDataType: Int {
  case Sensor = 0
  case System = 1
}

public enum KBAdvType: Int {
  case unknown = 0
}

open class KBAdvPacketBase {
  public let advType: KBAdvType
  public var uuid: String?
  public var majorID: NSNumber?
  public var minorID: NSNumber?
  public var advPeriod: NSNumber?
  public var txPower: NSNumber?
  public var rssi: NSNumber?

  public init(advType: KBAdvType = .unknown) {
    self.advType = advType
  }
}

public final class KBAdvPacketIBeacon: KBAdvPacketBase {}

public final class KBAdvPacketEddyUID: KBAdvPacketBase {
  public var nid: String?
  public var bid: String?
}

public final class KBAdvPacketEddyURL: KBAdvPacketBase {
  public var url: String?
}

public class KBAdvPacketSensor: KBAdvPacketBase {
  public var temperature: NSNumber?
  public var humidity: NSNumber?
  public var batteryLevel: NSNumber?
  public var isAccEnable = false
  public var isLightEnable = false
  public var isHumiEnable = false
  public var isTempEnable = false
  public var accX: NSNumber?
  public var accY: NSNumber?
  public var accZ: NSNumber?
  public var lightValue: NSNumber?
}

public class KBAdvPacketSystem: KBAdvPacketBase {
  public var batteryLevel: NSNumber?
  public var isAccEnable = false
  public var isLightEnable = false
  public var isHumiEnable = false
  public var isTempEnable = false
}

open class KBCfgBase {
  public init() {}
}

public final class KBCfgCommon: KBCfgBase {
  public var deviceName: String?
  public var advPeriod: NSNumber?
  public var txPower: NSNumber?
}

public final class KBCfgAdvIBeacon: KBCfgBase {
  public var uuid: String?
  public var majorID: NSNumber?
  public var minorID: NSNumber?
}

public final class KBCfgTrigger: KBCfgBase {
  public var triggerType: NSNumber?
  public var triggerAction: NSNumber?
  public var advInTrigger: NSNumber?
  public var advDuration: NSNumber?
}

public final class KBCfgSensorHT: KBCfgBase {
  public var tempMeasureInterval: NSNumber?
  public var humidMeasureInterval: NSNumber?
}

public final class KBSensorDataInfo {
  public var readNextPos = 0
  public var saveNum = 0
  public var unreadNum = 0
  public init() {}
}

public final class KBSensorDataMsg {
  public var utcTime = 0
  public var temperature: NSNumber?
  public var humidity: NSNumber?
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
  public weak var notifyDataDelegate: KBNotifyDataDelegate?

  public func mac() -> String { macAddress }
  public func name() -> String { deviceName }
  public func rssi() -> Int { signal }
  public func isConnectable() -> Bool { connectable }
  public func connectionState() -> KBConnState { state }

  public func connect(para: KBConnPara, delegate: KBConnStateDelegate?) {
    state = .Connected
    delegate?.onConnStateChange(self, state: state, err: .Success)
  }

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
    callback(true, 0, .Success)
  }

  public func readSensorDataInfo(_ completion: @escaping (Bool, KBSensorDataInfo?, KBConnErr) -> Void) {
    completion(true, KBSensorDataInfo(), .Success)
  }

  public func readSensorHistory(maxRecord: Int, completion: @escaping (Bool, [Any]?, KBConnErr) -> Void) {
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

  public func clearBeacons() {}
}
