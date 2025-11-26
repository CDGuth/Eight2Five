import ExpoModulesCore
import kbeaconlib2
import CoreBluetooth

public class ExpoKBeaconProModule: Module, KBeaconsMgrDelegate, KBConnStateDelegate, KBNotifyDataDelegate {
    
    var beaconManager: KBeaconsMgr?
    var connectedBeacons = [String: KBeacon]()

    // Helper to convert KBeacon to Dictionary
    private func beaconToDict(_ beacon: KBeacon) -> [String: Any?] {
        let dict: [String: Any?] = [
            "mac": beacon.mac(),
            "name": beacon.name(),
            "rssi": beacon.rssi(),
            "isConnectable": beacon.isConnectable(),
            "connectionState": beacon.connectionState().rawValue,
            "advPacket": advPacketToDict(beacon.advPacket)
        ]
        return dict
    }

    // Helper to convert KBAdvPacketBase to Dictionary
    private func advPacketToDict(_ advPacket: KBAdvPacketBase?) -> [String: Any?]? {
        guard let advPacket = advPacket else { return nil }

        var dict: [String: Any?] = [
            "advType": advPacket.advType.rawValue,
            "uuid": advPacket.uuid,
            "major": advPacket.majorID,
            "minor": advPacket.minorID,
            "advPeriod": advPacket.advPeriod,
            "txPower": advPacket.txPower,
            "rssi": advPacket.rssi
        ]

        if advPacket is KBAdvPacketIBeacon {
            // No extra fields for iBeacon beyond base
        } else if let eddyUIDPacket = advPacket as? KBAdvPacketEddyUID {
            dict["nid"] = eddyUIDPacket.nid
            dict["bid"] = eddyUIDPacket.bid
        } else if let eddyURLPacket = advPacket as? KBAdvPacketEddyURL {
            dict["url"] = eddyURLPacket.url
        } else if let sensorPacket = advPacket as? KBAdvPacketSensor {
            dict["temperature"] = sensorPacket.temperature
            dict["humidity"] = sensorPacket.humidity
            dict["batteryLevel"] = sensorPacket.batteryLevel
            dict["isAccEnable"] = sensorPacket.isAccEnable
            dict["isLightEnable"] = sensorPacket.isLightEnable
            dict["isHumiEnable"] = sensorPacket.isHumiEnable
            dict["isTempEnable"] = sensorPacket.isTempEnable
            dict["accX"] = sensorPacket.accX
            dict["accY"] = sensorPacket.accY
            dict["accZ"] = sensorPacket.accZ
            dict["lightValue"] = sensorPacket.lightValue
        } else if let systemPacket = advPacket as? KBAdvPacketSystem {
            dict["batteryLevel"] = systemPacket.batteryLevel
            dict["isAccEnable"] = systemPacket.isAccEnable
            dict["isLightEnable"] = systemPacket.isLightEnable
            dict["isHumiEnable"] = systemPacket.isHumiEnable
            dict["isTempEnable"] = systemPacket.isTempEnable
        }

        return dict
    }
    
    // Helper to convert Dictionary to KBCfgBase
    private func dictToCfg(_ dict: [String: Any]) -> KBCfgBase? {
        guard let type = dict["type"] as? String else { return nil }

        switch type {
        case "common":
            let cfg = KBCfgCommon()
            if let name = dict["name"] as? String { cfg.deviceName = name }
            if let period = dict["advPeriod"] as? Int { cfg.advPeriod = NSNumber(value: period) }
            if let power = dict["txPower"] as? Int { cfg.txPower = NSNumber(value: power) }
            return cfg
        case "iBeacon":
            let cfg = KBCfgAdvIBeacon()
            if let uuid = dict["uuid"] as? String { cfg.uuid = uuid }
            if let major = dict["major"] as? Int { cfg.majorID = NSNumber(value: major) }
            if let minor = dict["minor"] as? Int { cfg.minorID = NSNumber(value: minor) }
            return cfg
        case "trigger":
            let cfg = KBCfgTrigger()
            if let type = dict["triggerType"] as? Int { cfg.triggerType = NSNumber(value: type) }
            if let action = dict["triggerAction"] as? Int { cfg.triggerAction = NSNumber(value: action) }
            if let advMode = dict["advMode"] as? Int { cfg.advInTrigger = NSNumber(value: advMode) }
            if let advDuration = dict["advDuration"] as? Int { cfg.advDuration = NSNumber(value: advDuration) }
            return cfg
        case "sensorHT":
            let cfg = KBCfgSensorHT()
            if let tempInterval = dict["tempMeasureInterval"] as? Int { cfg.tempMeasureInterval = NSNumber(value: tempInterval) }
            if let humidInterval = dict["humidMeasureInterval"] as? Int { cfg.humidMeasureInterval = NSNumber(value: humidInterval) }
            return cfg
        default:
            return nil
        }
    }

    // KBeaconsMgrDelegate
    public func onBeaconDiscovered(_ beacons: [KBeacon]) {
        let beaconData = beacons.map { beaconToDict($0) }
        sendEvent("onBeaconDiscovered", ["beacons": beaconData])
    }

    public func onCentralBleStateChange(_ state: CBCentralManagerState) {
        // Optional: could send an event about BT state
    }

    // KBConnStateDelegate
    public func onConnStateChange(_ beacon: KBeacon, state: KBConnState, err: KBConnErr) {
        if state == .Connected {
            connectedBeacons[beacon.mac()] = beacon
            beacon.notifyDataDelegate = self
        } else if state == .Disconnected || state == .ConnectTimeout {
            connectedBeacons.removeValue(forKey: beacon.mac())
        }
        sendEvent("onConnectionStateChanged", [
            "mac": beacon.mac(),
            "state": state.rawValue,
            "error": err.rawValue
        ])
    }
    
    // KBNotifyDataDelegate
    public func onNotifyData(_ beacon: KBeacon, type: KBNotifyDataType, data: Any) {
        var eventData: [String: Any?] = [
            "mac": beacon.mac(),
            "type": type.rawValue,
            "data": nil
        ]
        
        if let sensorData = data as? KBSensorDataMsg {
            eventData["data"] = [
                "utcTime": sensorData.utcTime,
                "temperature": sensorData.temperature as Any,
                "humidity": sensorData.humidity as Any
            ]
        }
        
        sendEvent("onNotifyDataReceived", eventData)
    }

    public func definition() -> ModuleDefinition {
        Name("ExpoKBeaconPro")

        Events("onBeaconDiscovered", "onConnectionStateChanged", "onNotifyDataReceived")

        OnCreate {
            self.beaconManager = KBeaconsMgr.sharedBeaconManager()
            self.beaconManager?.delegate = self
        }

        Function("startScanning") {
            let result = self.beaconManager?.startScanning() ?? KBeaconErr.BLESystem.rawValue
            if result != KBeaconErr.Success.rawValue {
                print("Start scanning failed with error: \(result)")
            }
        }

        Function("stopScanning") {
            self.beaconManager?.stopScanning()
        }
        
        Function("clearBeacons") {
            self.beaconManager?.clearBeacons()
        }

        AsyncFunction("connectEnhanced") { (mac: String, timeout: Int, promise: Promise) in
            guard let beacon = self.findBeacon(mac: mac) else {
                promise.reject("BEACON_NOT_FOUND", "Beacon with MAC \(mac) not found")
                return
            }
            
            let connPara = KBConnPara(timeout: Float(timeout))
            beacon.connect(para: connPara, delegate: self)
            // The result is handled by the onConnStateChange delegate
            promise.resolve(nil)
        }

        AsyncFunction("disconnect") { (mac: String, promise: Promise) in
            guard let beacon = self.findBeacon(mac: mac) else {
                promise.reject("BEACON_NOT_FOUND", "Beacon with MAC \(mac) not found")
                return
            }
            beacon.disconnect()
            promise.resolve(nil)
        }
        
        AsyncFunction("modifyConfig") { (mac: String, configs: [[String: Any]], promise: Promise) in
            guard let beacon = self.connectedBeacons[mac] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(mac) is not connected")
                return
            }
            
            let cfgObjects = configs.compactMap { self.dictToCfg($0) }
            
            if cfgObjects.isEmpty && !configs.isEmpty {
                promise.reject("INVALID_CONFIG", "Invalid configuration objects provided")
                return
            }
            
            beacon.modifyConfig(obj: cfgObjects) { (result, cmd, err) in
                if result {
                    promise.resolve(true)
                } else {
                    promise.reject("CONFIG_FAILED", "Failed to modify config. Error: \(err.rawValue)")
                }
            }
        }
        
        AsyncFunction("readSensorDataInfo") { (mac: String, promise: Promise) in
            guard let beacon = self.connectedBeacons[mac] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(mac) is not connected")
                return
            }
            
            beacon.readSensorDataInfo { (result, info, err) in
                if result, let info = info {
                    promise.resolve([
                        "readNextPos": info.readNextPos,
                        "saveNum": info.saveNum,
                        "unreadNum": info.unreadNum
                    ])
                } else {
                    promise.reject("READ_FAILED", "Failed to read sensor data info. Error: \(err.rawValue)")
                }
            }
        }
        
        AsyncFunction("readSensorHistory") { (mac: String, maxRecord: Int, promise: Promise) in
            guard let beacon = self.connectedBeacons[mac] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(mac) is not connected")
                return
            }
            
            beacon.readSensorHistory(maxRecord: maxRecord) { (result, records, err) in
                if result, let records = records as? [KBSensorDataMsg] {
                    let recordDicts = records.map { [
                        "utcTime": $0.utcTime,
                        "temperature": $0.temperature as Any,
                        "humidity": $0.humidity as Any
                    ] }
                    promise.resolve(recordDicts)
                } else {
                    promise.reject("READ_FAILED", "Failed to read sensor history. Error: \(err.rawValue)")
                }
            }
        }
        
        AsyncFunction("clearSensorHistory") { (mac: String, promise: Promise) in
            guard let beacon = self.connectedBeacons[mac] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(mac) is not connected")
                return
            }
            
            beacon.clearSensorHistoryData { (result, err) in
                if result {
                    promise.resolve(true)
                } else {
                    promise.reject("CLEAR_FAILED", "Failed to clear sensor history. Error: \(err.rawValue)")
                }
            }
        }
        
        AsyncFunction("subscribeSensorDataNotify") { (mac: String, promise: Promise) in
            guard let beacon = self.connectedBeacons[mac] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(mac) is not connected")
                return
            }
            
            beacon.subscribeSensorDataNotify { (result, err) in
                if result {
                    promise.resolve(true)
                } else {
                    promise.reject("SUBSCRIBE_FAILED", "Failed to subscribe to sensor data. Error: \(err.rawValue)")
                }
            }
        }
        
        AsyncFunction("unsubscribeSensorDataNotify") { (mac: String, promise: Promise) in
            guard let beacon = self.connectedBeacons[mac] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(mac) is not connected")
                return
            }
            
            beacon.unsubscribeSensorDataNotify { (result, err) in
                if result {
                    promise.resolve(true)
                } else {
                    promise.reject("UNSUBSCRIBE_FAILED", "Failed to unsubscribe from sensor data. Error: \(err.rawValue)")
                }
            }
        }
        
        return ModuleDefinition()
    }

    private func findBeacon(mac: String) -> KBeacon? {
        // First check manager's list of scanned beacons
        if let beacon = self.beaconManager?.beacons.first(where: { $0.mac().uppercased() == mac.uppercased() }) {
            return beacon
        }
        // Then check our list of connected beacons
        if let beacon = self.connectedBeacons[mac.uppercased()] {
            return beacon
        }
        return nil
    }
}
