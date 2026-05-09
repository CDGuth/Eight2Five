import ExpoModulesCore
import kbeaconlib2
import CoreBluetooth

public class ExpoKBeaconProModule: Module, KBeaconsMgrDelegate, KBConnStateDelegate, KBNotifyDataDelegate {
    private var beaconManager: KBeaconsMgr?
    private var connectedBeacons = [String: KBeacon]()
    private var pendingConnectionPromises = [String: Promise]()

    private func normalizedMac(_ mac: String) -> String {
        return mac.uppercased()
    }

    private func normalizedTimeoutSeconds(_ timeout: Int?) -> Float {
        guard let timeout = timeout else { return 15.0 }
        if timeout > 1000 {
            return max(1.0, Float(timeout) / 1000.0)
        }

        return max(1.0, Float(timeout))
    }

    private func normalizedPassword(_ password: String?) -> String {
        guard let password = password, !password.isEmpty else {
            return "0000000000000000"
        }

        return password
    }

    // Helper to convert KBeacon to Dictionary
    private func beaconToDict(_ beacon: KBeacon) -> [String: Any?] {
        let advPacket = advPacketToDict(beacon.advPacket)
        let dict: [String: Any?] = [
            "mac": beacon.mac(),
            "name": beacon.name(),
            "rssi": beacon.rssi(),
            "isConnectable": beacon.isConnectable(),
            "connectionState": beacon.connectionState().rawValue,
            "advPackets": advPacket.map { [$0] } ?? []
        ]
        return dict
    }

    // Helper to convert KBAdvPacketBase to Dictionary
    private func advPacketToDict(_ advPacket: KBAdvPacketBase?) -> [String: Any?]? {
        guard let advPacket = advPacket else { return nil }

        var dict: [String: Any?] = [
            "advType": advPacket.advType.rawValue,
            "uuid": advPacket.uuid,
            "majorID": advPacket.majorID,
            "minorID": advPacket.minorID,
            "advPeriod": advPacket.advPeriod,
            "txPower": advPacket.txPower,
            "rssi": advPacket.rssi
        ]

        if advPacket is KBAdvPacketIBeacon {
            // No extra fields for iBeacon beyond base
        } else if let eddyUIDPacket = advPacket as? KBAdvPacketEddyUID {
            dict["nid"] = eddyUIDPacket.nid
            dict["sid"] = eddyUIDPacket.bid
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
            if let major = dict["majorID"] as? Int ?? dict["major"] as? Int {
                cfg.majorID = NSNumber(value: major)
            }
            if let minor = dict["minorID"] as? Int ?? dict["minor"] as? Int {
                cfg.minorID = NSNumber(value: minor)
            }
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
        let macAddress = beacon.mac()
        let normalized = normalizedMac(macAddress)

        if state == .Connected {
            connectedBeacons[normalized] = beacon
            beacon.notifyDataDelegate = self
        } else if state == .Disconnected || state == .ConnectTimeout {
            connectedBeacons.removeValue(forKey: normalized)
        }

        sendEvent("onConnectionStateChanged", [
            "macAddress": macAddress,
            "state": state.rawValue,
            "reason": err.rawValue
        ])

        guard let promise = pendingConnectionPromises.removeValue(forKey: normalized) else {
            return
        }

        if state == .Connected {
            promise.resolve(true)
        } else if state == .Disconnected || state == .ConnectTimeout {
            promise.resolve(false)
        }
    }
    
    // KBNotifyDataDelegate
    public func onNotifyData(_ beacon: KBeacon, type: KBNotifyDataType, data: Any) {
        let payload: Any

        if let byteData = data as? Data {
            payload = byteData.map { Int($0) }
        } else if let byteArray = data as? [UInt8] {
            payload = byteArray.map { Int($0) }
        } else if let numberArray = data as? [NSNumber] {
            payload = numberArray.map { $0.intValue }
        } else if let sensorData = data as? KBSensorDataMsg {
            payload = [
                "utcTime": sensorData.utcTime,
                "temperature": sensorData.temperature as Any,
                "humidity": sensorData.humidity as Any
            ]
        } else {
            payload = NSNull()
        }

        let eventData: [String: Any] = [
            "macAddress": beacon.mac(),
            "eventType": type.rawValue,
            "data": payload
        ]

        sendEvent("onNotifyDataReceived", eventData)
    }

    private func connectInternal(
        macAddress: String,
        password: String?,
        timeout: Int?,
        connParaMap: [String: Any]?,
        promise: Promise
    ) {
        guard let beacon = self.findBeacon(mac: macAddress) else {
            promise.resolve(false)
            return
        }

        let normalized = normalizedMac(macAddress)
        pendingConnectionPromises.removeValue(forKey: normalized)?.resolve(false)
        pendingConnectionPromises[normalized] = promise

        let beaconPassword = normalizedPassword(password)
        let timeoutSeconds = normalizedTimeoutSeconds(timeout)

        if let connParaMap = connParaMap {
            let connPara = KBConnPara()
            if let syncUtcTime = connParaMap["syncUtcTime"] as? Bool {
                connPara.syncUtcTime = syncUtcTime
            }
            if let readCommPara = connParaMap["readCommPara"] as? Bool {
                connPara.readCommPara = readCommPara
            }
            if let readSlotPara = connParaMap["readSlotPara"] as? Bool {
                connPara.readSlotPara = readSlotPara
            }
            if let readTriggerPara = connParaMap["readTriggerPara"] as? Bool {
                connPara.readTriggerPara = readTriggerPara
            }
            if let readSensorPara = connParaMap["readSensorPara"] as? Bool {
                connPara.readSensorPara = readSensorPara
            }

            beacon.connectEnhanced(
                beaconPassword,
                timeout: timeoutSeconds,
                connPara: connPara,
                delegate: self
            )
            return
        }

        beacon.connect(beaconPassword, timeout: timeoutSeconds, delegate: self)
    }

    public func definition() -> ModuleDefinition {
        Name("ExpoKBeaconPro")

        Events("onBeaconDiscovered", "onConnectionStateChanged", "onNotifyDataReceived")

        OnCreate {
            self.beaconManager = KBeaconsMgr.sharedBeaconManager()
            self.beaconManager?.delegate = self
        }

        OnDestroy {
            self.beaconManager?.stopScanning()
            self.beaconManager?.delegate = nil

            self.connectedBeacons.values.forEach {
                $0.notifyDataDelegate = nil
                $0.disconnect()
            }

            self.connectedBeacons.removeAll()
            self.pendingConnectionPromises.values.forEach { $0.resolve(false) }
            self.pendingConnectionPromises.removeAll()
            self.beaconManager = nil
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

        AsyncFunction("connect") { (macAddress: String, password: String?, timeout: Int?, promise: Promise) in
            self.connectInternal(
                macAddress: macAddress,
                password: password,
                timeout: timeout,
                connParaMap: nil,
                promise: promise
            )
        }

        AsyncFunction("connectEnhanced") { (macAddress: String, password: String?, timeout: Int?, connParaMap: [String: Any]?, promise: Promise) in
            self.connectInternal(
                macAddress: macAddress,
                password: password,
                timeout: timeout,
                connParaMap: connParaMap,
                promise: promise
            )
        }

        AsyncFunction("disconnect") { (macAddress: String, promise: Promise) in
            guard let beacon = self.findBeacon(mac: macAddress) else {
                promise.resolve(false)
                return
            }

            let normalized = normalizedMac(macAddress)
            pendingConnectionPromises.removeValue(forKey: normalized)
            connectedBeacons.removeValue(forKey: normalized)
            beacon.disconnect()
            promise.resolve(true)
        }
        
        AsyncFunction("modifyConfig") { (macAddress: String, configs: [[String: Any]], promise: Promise) in
            guard let beacon = self.connectedBeacons[normalizedMac(macAddress)] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(macAddress) is not connected")
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
        
        AsyncFunction("readSensorDataInfo") { (macAddress: String, _: Int, promise: Promise) in
            guard let beacon = self.connectedBeacons[normalizedMac(macAddress)] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(macAddress) is not connected")
                return
            }
            
            beacon.readSensorDataInfo { (result, info, err) in
                if result, let info = info {
                    promise.resolve([
                        "totalRecordNum": info.saveNum,
                        "unreadRecordNum": info.unreadNum,
                        "readIndex": info.readNextPos
                    ])
                } else {
                    promise.reject("READ_FAILED", "Failed to read sensor data info. Error: \(err.rawValue)")
                }
            }
        }
        
        AsyncFunction("readSensorHistory") { (macAddress: String, _: Int, maxRecord: Int, _: Int?, promise: Promise) in
            guard let beacon = self.connectedBeacons[normalizedMac(macAddress)] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(macAddress) is not connected")
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
        
        AsyncFunction("clearSensorHistory") { (macAddress: String, _: Int, promise: Promise) in
            guard let beacon = self.connectedBeacons[normalizedMac(macAddress)] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(macAddress) is not connected")
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
        
        AsyncFunction("subscribeSensorDataNotify") { (macAddress: String, _: Int, promise: Promise) in
            guard let beacon = self.connectedBeacons[normalizedMac(macAddress)] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(macAddress) is not connected")
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
        
        AsyncFunction("unsubscribeSensorDataNotify") { (macAddress: String, _: Int, promise: Promise) in
            guard let beacon = self.connectedBeacons[normalizedMac(macAddress)] else {
                promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC \(macAddress) is not connected")
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
        
    }

    private func findBeacon(mac: String) -> KBeacon? {
        let normalized = mac.uppercased()

        // First check manager's list of scanned beacons
        if let beacon = self.beaconManager?.beacons.first(where: { $0.mac().uppercased() == normalized }) {
            return beacon
        }

        // Then check our list of connected beacons
        if let beacon = self.connectedBeacons[normalized] {
            return beacon
        }

        return nil
    }
}
