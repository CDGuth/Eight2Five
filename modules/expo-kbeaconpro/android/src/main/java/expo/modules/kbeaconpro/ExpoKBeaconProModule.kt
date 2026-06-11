package expo.modules.kbeaconpro

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketBase
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketEBeacon
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketEddyTLM
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketEddyUID
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketEddyURL
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketIBeacon
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketSensor
import com.kkmcn.kbeaconlib2.KBAdvPackage.KBAdvPacketSystem
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvBase
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvEBeacon
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvEddyTLM
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvEddyUID
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvEddyURL
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvIBeacon
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvKSensor
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgBase
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgCommon
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgSensorGEO
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgSensorHT
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgSensorLight
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgSensorPIR
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgSensorScan
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgTrigger
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgTriggerAngle
import com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgTriggerMotion
import com.kkmcn.kbeaconlib2.KBConnPara
import com.kkmcn.kbeaconlib2.KBConnState
import com.kkmcn.kbeaconlib2.KBConnectionEvent
import com.kkmcn.kbeaconlib2.KBSensorHistoryData.KBRecordDataRsp
import com.kkmcn.kbeaconlib2.KBSensorHistoryData.KBSensorReadOption
import com.kkmcn.kbeaconlib2.KBeacon
import com.kkmcn.kbeaconlib2.KBeaconsMgr
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsResponseListener
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.ArrayList
import java.util.Locale

private const val DEFAULT_TIMEOUT_MS = 15_000
private const val ADV_TYPE_IBEACON = 0
private const val ADV_TYPE_EDDY_TLM = 1
private const val ADV_TYPE_EDDY_UID = 2
private const val ADV_TYPE_EDDY_URL = 3
private const val ADV_TYPE_SENSOR = 4
private const val ADV_TYPE_EBEACON = 6
private const val ADV_TYPE_UNKNOWN = 255
private const val MAX_SENSOR_RECORD_POSITION = 0xffffffffL

class ExpoKBeaconProModule : Module() {
  private var beaconManager: KBeaconsMgr? = null
  private var isDestroyed = false
  private val discoveredBeacons = mutableMapOf<String, KBeacon>()
  private val activeConnections = mutableMapOf<String, KBeacon>()
  private val pendingConnectionPromises = mutableMapOf<String, Promise>()
  private val notificationSubscriptions = mutableSetOf<String>()
  private val notificationDelegates = mutableMapOf<String, KBeacon.NotifyDataDelegate>()

  override fun definition() = ModuleDefinition {
    Name("ExpoKBeaconPro")

    Events(
      "onBeaconDiscovered",
      "onConnectionStateChanged",
      "onNotifyDataReceived",
      "onBluetoothStateChanged",
      "onError"
    )

    OnCreate {
      isDestroyed = false
      val context = appContext.reactContext ?: return@OnCreate
      beaconManager = KBeaconsMgr.sharedBeaconManager(context)
      beaconManager?.delegate = object : KBeaconsMgr.KBeaconMgrDelegate {
        override fun onBeaconDiscovered(beacons: Array<KBeacon>?) {
          val beaconData = beacons?.map { beacon ->
            val mac = normalizedMac(beacon.mac)
            discoveredBeacons[mac] = beacon
            beaconToMap(beacon)
          } ?: emptyList()

          sendEvent("onBeaconDiscovered", mapOf("beacons" to beaconData))
        }

        override fun onCentralBleStateChang(newState: Int) {
          sendEvent(
            "onBluetoothStateChanged",
            mapOf("state" to androidBleStateToString(newState))
          )
        }

        override fun onScanFailed(errorCode: Int) {
          sendEvent(
            "onError",
            mapOf(
              "code" to "SCAN_FAILED",
              "message" to "KBeacon scan failed with code $errorCode"
            )
          )
        }
      }
    }

    OnDestroy {
      cleanupModule()
    }

    AsyncFunction("startScanning") { promise: Promise ->
      val manager = beaconManager
      if (manager == null) {
        rejectAndEmit(promise, "BLUETOOTH_UNAVAILABLE", "KBeacon manager is unavailable")
        return@AsyncFunction
      }

      val context = appContext.reactContext
      if (context == null || !hasBluetoothSupport(context) || !isBluetoothEnabled(context)) {
        rejectAndEmit(promise, "BLUETOOTH_UNAVAILABLE", "Bluetooth is unavailable or powered off")
        return@AsyncFunction
      }

      if (!hasRequiredRuntimePermissions(context)) {
        rejectAndEmit(promise, "PERMISSION_DENIED", "Required Bluetooth permissions are not granted")
        return@AsyncFunction
      }

      val result = manager.startScanning()
      if (result != 0) {
        rejectAndEmit(promise, "SCAN_FAILED", "KBeacon scanning failed with code $result")
        return@AsyncFunction
      }

      promise.resolve(null)
    }

    Function("stopScanning") {
      beaconManager?.stopScanning()
    }

    Function("clearBeacons") {
      beaconManager?.clearBeacons()
      discoveredBeacons.clear()
    }

    Function("getCapabilities") {
      capabilitiesMap()
    }

    Function("getPermissionStatus") {
      currentPermissionStatus()
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      val permissionsToRequest = runtimePermissionsForPlatform()
      if (permissionsToRequest.isEmpty()) {
        promise.resolve(currentPermissionStatus())
        return@AsyncFunction
      }

      val permissionsManager = appContext.permissions
      if (permissionsManager == null) {
        rejectAndEmit(promise, "OPERATION_FAILED", "Expo permissions manager is unavailable")
        return@AsyncFunction
      }

      permissionsManager.askForPermissions(
        PermissionsResponseListener { response ->
          promise.resolve(permissionStatusFromResponses(response))
        },
        *permissionsToRequest
      )
    }

    AsyncFunction("connect") { macAddress: String, password: String?, timeoutMs: Int?, promise: Promise ->
      connectInternal(macAddress, password, timeoutMs, null, promise)
    }

    AsyncFunction("connectEnhanced") { macAddress: String, password: String?, timeoutMs: Int?, connParaMap: Map<String, Any?>?, promise: Promise ->
      connectInternal(macAddress, password, timeoutMs, connParaMap, promise)
    }

    AsyncFunction("disconnect") { macAddress: String, promise: Promise ->
      val normalized = normalizedMac(macAddress)
      val beacon = activeConnections.remove(normalized) ?: findBeacon(macAddress)
      pendingConnectionPromises.remove(normalized)?.reject(
        "OPERATION_FAILED",
        "Connection was cancelled by disconnect",
        null
      )
      notificationDelegates.keys.removeAll { it.startsWith("$normalized:") }
      notificationSubscriptions.removeAll { it.startsWith("$normalized:") }

      if (beacon == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      beacon.disconnect()
      promise.resolve(true)
    }

    AsyncFunction("modifyConfig") { macAddress: String, configs: List<Map<String, Any?>>, promise: Promise ->
      val normalized = normalizedMac(macAddress)
      val beacon = activeConnections[normalized]
      if (beacon == null) {
        promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC $normalized is not connected", null)
        return@AsyncFunction
      }

      if (configs.isEmpty()) {
        promise.reject("INVALID_CONFIG", "configs must be a non-empty array", null)
        return@AsyncFunction
      }

      val cfgList = ArrayList<KBCfgBase>()
      try {
        configs.forEachIndexed { index, config ->
          cfgList.add(mapToKBCfg(config, index))
        }
      } catch (error: IllegalArgumentException) {
        promise.reject("INVALID_CONFIG", error.message ?: "Invalid configuration", null)
        return@AsyncFunction
      }

      beacon.modifyConfig(cfgList) { success, exception ->
        if (success) {
          promise.resolve(true)
        } else {
          promise.reject("CONFIG_FAILED", exception?.description ?: "Configuration failed", null)
        }
      }
    }

    AsyncFunction("readDeviceSnapshot") { macAddress: String, promise: Promise ->
      val normalized = normalizedMac(macAddress)
      val beacon = activeConnections[normalized]
      if (beacon == null) {
        promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC $normalized is not connected", null)
        return@AsyncFunction
      }

      promise.resolve(deviceSnapshot(beacon))
    }

    AsyncFunction("readSensorDataInfo") { macAddress: String, sensorType: Int, promise: Promise ->
      val beacon = connectedBeaconOrReject(macAddress, promise) ?: return@AsyncFunction
      beacon.readSensorDataInfo(sensorType) { success, info, exception ->
        if (!success || info == null) {
          promise.reject(
            "READ_FAILED",
            exception?.description ?: "Failed to read sensor data info",
            null
          )
          return@readSensorDataInfo
        }

        val payload = mutableMapOf<String, Any>(
          "totalRecordNum" to (info.totalRecordNumber ?: 0),
          "unreadRecordNum" to (info.unreadRecordNumber ?: 0)
        )
        info.sensorType?.let { payload["sensorType"] = it }
        info.readInfoUtcSeconds?.let { payload["readInfoUtcSeconds"] = it }

        promise.resolve(payload)
      }
    }

    AsyncFunction("readSensorRecords") { macAddress: String, request: Map<String, Any?>, promise: Promise ->
      val beacon = connectedBeaconOrReject(macAddress, promise) ?: return@AsyncFunction
      val sensorType = integerLongValue(request, "sensorType")?.toInt()
      if (sensorType == null || !isSupportedSensorType(sensorType)) {
        promise.reject("INVALID_ARGUMENT", "sensorType is invalid", null)
        return@AsyncFunction
      }

      val readOption = integerLongValue(request, "readOption")?.toInt()
      if (readOption == null) {
        promise.reject("INVALID_ARGUMENT", "readOption is required", null)
        return@AsyncFunction
      }
      if (!isSupportedReadOption(readOption)) {
        promise.reject("INVALID_ARGUMENT", "readOption must be 0, 1, or 2", null)
        return@AsyncFunction
      }

      val maxRecords = integerLongValue(request, "maxRecords")?.toInt()
      if (maxRecords == null || maxRecords <= 0) {
        promise.reject("INVALID_ARGUMENT", "maxRecords must be a positive integer", null)
        return@AsyncFunction
      }

      val readPosition = integerLongValue(request, "readPosition")
        ?: KBRecordDataRsp.INVALID_DATA_RECORD_POS
      if (readPosition < 0 || readPosition > MAX_SENSOR_RECORD_POSITION) {
        promise.reject("INVALID_ARGUMENT", "readPosition must be between 0 and 4294967295", null)
        return@AsyncFunction
      }

      beacon.readSensorRecord(sensorType, readPosition, readOption, maxRecords) { success, response, exception ->
        if (!success || response == null) {
          promise.reject(
            "READ_FAILED",
            exception?.description ?: "Failed to read sensor records",
            null
          )
          return@readSensorRecord
        }

        val records = response.readDataRspList.map { record ->
          sensorRecordToMap(record, sensorType)
        }
        val payload = mutableMapOf<String, Any>("records" to records)

        response.readDataNextPos?.let { next ->
          if (next != KBRecordDataRsp.INVALID_DATA_RECORD_POS) {
            payload["nextReadPosition"] = next
          }
        }

        promise.resolve(payload)
      }
    }

    AsyncFunction("clearSensorHistory") { macAddress: String, sensorType: Int, promise: Promise ->
      val beacon = connectedBeaconOrReject(macAddress, promise) ?: return@AsyncFunction
      beacon.clearSensorRecord(sensorType) { success, exception ->
        if (success) {
          promise.resolve(true)
        } else {
          promise.reject("OPERATION_FAILED", exception?.description ?: "Failed to clear sensor history", null)
        }
      }
    }

    AsyncFunction("subscribeNotify") { macAddress: String, eventType: Int?, promise: Promise ->
      val normalized = normalizedMac(macAddress)
      val beacon = connectedBeaconOrReject(macAddress, promise) ?: return@AsyncFunction
      if (eventType == null) {
        promise.reject("INVALID_ARGUMENT", "eventType is required", null)
        return@AsyncFunction
      }

      val key = notificationKey(normalized, eventType)
      val delegate = object : KBeacon.NotifyDataDelegate {
        override fun onNotifyDataReceived(beacon: KBeacon, nEventType: Int, sensorData: ByteArray) {
          val mac = beacon.mac?.let { normalizedMac(it) } ?: normalized
          sendEvent(
            "onNotifyDataReceived",
            mapOf(
              "macAddress" to mac,
              "eventType" to nEventType,
              "raw" to sensorData.map { it.toInt() and 0xff },
              "data" to null
            )
          )
        }
      }

      notificationDelegates[key] = delegate
      beacon.subscribeSensorDataNotify(eventType, delegate) { success, exception ->
        if (success) {
          notificationSubscriptions.add(key)
          promise.resolve(true)
        } else {
          notificationDelegates.remove(key)
          promise.reject("SUBSCRIBE_FAILED", exception?.description ?: "Failed to subscribe", null)
        }
      }
    }

    AsyncFunction("unsubscribeNotify") { macAddress: String, eventType: Int?, promise: Promise ->
      val normalized = normalizedMac(macAddress)
      val beacon = connectedBeaconOrReject(macAddress, promise) ?: return@AsyncFunction
      if (eventType == null) {
        promise.reject("INVALID_ARGUMENT", "eventType is required", null)
        return@AsyncFunction
      }

      val key = notificationKey(normalized, eventType)
      beacon.removeSubscribeSensorDataNotify(eventType) { success, exception ->
        if (success) {
          notificationSubscriptions.remove(key)
          notificationDelegates.remove(key)
          promise.resolve(true)
        } else {
          promise.reject("UNSUBSCRIBE_FAILED", exception?.description ?: "Failed to unsubscribe", null)
        }
      }
    }
  }

  private fun cleanupModule() {
    isDestroyed = true
    beaconManager?.stopScanning()
    beaconManager?.clearBeacons()
    beaconManager?.delegate = null
    KBeaconsMgr.clearBeaconManager()
    activeConnections.values.forEach { beacon -> beacon.disconnect() }
    pendingConnectionPromises.values.forEach { promise ->
      promise.reject("OPERATION_FAILED", "Module was destroyed", null)
    }
    discoveredBeacons.clear()
    activeConnections.clear()
    pendingConnectionPromises.clear()
    notificationSubscriptions.clear()
    notificationDelegates.clear()
    beaconManager = null
  }

  private fun connectInternal(
    macAddress: String,
    password: String?,
    timeoutMs: Int?,
    connParaMap: Map<String, Any?>?,
    promise: Promise
  ) {
    if (isDestroyed) {
      promise.reject("OPERATION_FAILED", "Module has been destroyed", null)
      return
    }

    val normalized = normalizedMac(macAddress)
    if (activeConnections.containsKey(normalized)) {
      promise.resolve(true)
      return
    }

    if (pendingConnectionPromises.containsKey(normalized)) {
      promise.reject("CONNECTION_BUSY", "Connection already pending for $normalized", null)
      return
    }

    val beacon = findBeacon(macAddress)
    if (beacon == null) {
      promise.reject("BEACON_NOT_FOUND", "Beacon with MAC $normalized was not discovered", null)
      return
    }

    val resolvedTimeoutMs = timeoutMs ?: DEFAULT_TIMEOUT_MS
    if (resolvedTimeoutMs <= 0) {
      promise.reject("INVALID_ARGUMENT", "timeoutMs must be a positive integer", null)
      return
    }

    pendingConnectionPromises[normalized] = promise
    val connPara = connParaMap?.let { map ->
      KBConnPara().apply {
        (map["syncUtcTime"] as? Boolean)?.let { syncUtcTime = it }
        (map["readCommPara"] as? Boolean)?.let { readCommPara = it }
        (map["readSlotPara"] as? Boolean)?.let { readSlotPara = it }
        (map["readTriggerPara"] as? Boolean)?.let { readTriggerPara = it }
        (map["readSensorPara"] as? Boolean)?.let { readSensorPara = it }
      }
    }

    val callback = object : KBeacon.ConnStateDelegate {
      override fun onConnStateChange(beacon: KBeacon, state: KBConnState, nReason: Int) {
        sendConnectionState(normalized, state, nReason)

        if (state == KBConnState.Connected) {
          activeConnections[normalized] = beacon
          pendingConnectionPromises.remove(normalized)?.resolve(true)
          return
        }

        if (state == KBConnState.Disconnected) {
          activeConnections.remove(normalized)
          notificationDelegates.keys.removeAll { it.startsWith("$normalized:") }
          notificationSubscriptions.removeAll { it.startsWith("$normalized:") }

          val pending = pendingConnectionPromises.remove(normalized) ?: return

          when (nReason) {
            KBConnectionEvent.ConnTimeout ->
              pending.reject("CONNECTION_TIMEOUT", "Connection timed out", null)

            KBConnectionEvent.ConnAuthFail ->
              pending.reject("AUTH_FAILED", "Beacon authentication failed", null)

            else ->
              pending.reject(
                "OPERATION_FAILED",
                "Connection failed with reason $nReason",
                null
              )
          }
        }
      }
    }

    val started = if (connPara != null) {
      beacon.connectEnhanced(normalizedPassword(password), resolvedTimeoutMs, connPara, callback)
    } else {
      beacon.connect(normalizedPassword(password), resolvedTimeoutMs, callback)
    }

    if (!started) {
      pendingConnectionPromises.remove(normalized)
      promise.reject("OPERATION_FAILED", "Native connect request failed", null)
    }
  }

  private fun findBeacon(macAddress: String): KBeacon? {
    val normalized = normalizedMac(macAddress)
    activeConnections[normalized]?.let { return it }
    discoveredBeacons[normalized]?.let { return it }
    return beaconManager?.getBeacon(normalized)
  }

  private fun connectedBeaconOrReject(macAddress: String, promise: Promise): KBeacon? {
    val normalized = normalizedMac(macAddress)
    val beacon = activeConnections[normalized]
    if (beacon == null) {
      promise.reject("BEACON_NOT_CONNECTED", "Beacon with MAC $normalized is not connected", null)
    }

    return beacon
  }

  private fun normalizedMac(macAddress: String): String {
    return macAddress.uppercase(Locale.US)
  }

  private fun normalizedPassword(password: String?): String {
    return if (password.isNullOrEmpty()) "0000000000000000" else password
  }

  private fun notificationKey(mac: String, eventType: Int): String {
    return "$mac:$eventType"
  }

  private fun beaconToMap(beacon: KBeacon): Map<String, Any?> {
    val normalized = normalizedMac(beacon.mac)
    val packets = beacon.allAdvPackets()?.map { packet -> advPacketToMap(packet) } ?: emptyList()
    runCatching { beacon.removeAdvPacket() }

    return mutableMapOf<String, Any?>(
      "deviceId" to normalized,
      "mac" to normalized,
      "name" to beacon.name,
      "rssi" to beacon.rssi,
      "advPackets" to packets
    ).apply {
      put("connectionState", connectionStateToInt(beacon.state))
    }
  }

  private fun advPacketToMap(packet: KBAdvPacketBase): Map<String, Any?> {
    val map = mutableMapOf<String, Any?>("advType" to packet.advType)
    when (packet) {
      is KBAdvPacketIBeacon -> {
        map["uuid"] = packet.uuid
        map["majorID"] = packet.majorID
        map["minorID"] = packet.minorID
      }
      is KBAdvPacketEddyTLM -> {
        map["batteryLevel"] = packet.batteryLevel
        map["temperature"] = packet.temperature
        map["advCount"] = packet.advCount
        map["secCount"] = packet.secCount
      }
      is KBAdvPacketEddyUID -> {
        map["nid"] = normalizeHexString(packet.nid)
        map["sid"] = normalizeHexString(packet.sid)
      }
      is KBAdvPacketEddyURL -> {
        map["url"] = packet.url
      }
      is KBAdvPacketSensor -> {
        map["batteryLevel"] = packet.batteryLevel
        map["temperature"] = packet.temperature
        packet.humidity?.let { map["humidity"] = it }
        packet.accSensor?.let {
          map["accSensor"] = mapOf("xAis" to it.xAis, "yAis" to it.yAis, "zAis" to it.zAis)
        }
        packet.alarmStatus?.let { map["alarmStatus"] = it }
        packet.pirIndication?.let { map["pirIndication"] = it }
        packet.luxValue?.let { map["luxValue"] = it }
      }
      is KBAdvPacketSystem -> {
        map["macAddress"] = packet.macAddress?.let { normalizedMac(it) }
        map["model"] = packet.model
        map["batteryPercent"] = packet.batteryPercent
        map["version"] = packet.version
      }
      is KBAdvPacketEBeacon -> {
        map["mac"] = packet.mac?.let { normalizedMac(it) }
        map["uuid"] = packet.uuid
        map["utcSecCount"] = packet.utcSecCount
        map["refTxPower"] = packet.refTxPower
      }
      else -> {
        map["advType"] = ADV_TYPE_UNKNOWN
        map["raw"] = mapOf("className" to packet.javaClass.name)
      }
    }

    return map.filterValues { it != null }
  }

  private fun normalizeHexString(value: String?): String? {
    if (value.isNullOrBlank()) return value
    val withoutPrefix = value.removePrefix("0x").removePrefix("0X")
    return "0x${withoutPrefix.lowercase(Locale.US)}"
  }

  private fun mapToKBCfg(map: Map<String, Any?>, index: Int): KBCfgBase {
    return when (map["configType"] as? String) {
      "common" -> mapCommonConfig(map)
      "advertisement" -> mapAdvertisementConfig(map, index)
      "trigger" -> mapTriggerConfig(map, index)
      "sensor" -> mapSensorConfig(map, index)
      else -> throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
    }
  }

  private fun mapCommonConfig(map: Map<String, Any?>): KBCfgCommon {
    return KBCfgCommon().apply {
      (map["name"] as? String)?.let { name = it }
      (map["alwaysPowerOn"] as? Boolean)?.let { alwaysPowerOn = it }
      (map["password"] as? String)?.let { password = it }
      numberValue(map, "refPower1Meters")?.let { refPower1Meters = it.toInt() }
    }
  }

  private fun mapAdvertisementConfig(map: Map<String, Any?>, index: Int): KBCfgBase {
    val advType = numberValue(map, "advType")?.toInt()
      ?: throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
    val cfg = when (advType) {
      ADV_TYPE_IBEACON -> KBCfgAdvIBeacon().apply {
        (map["uuid"] as? String)?.let { uuid = it }
        numberValue(map, "majorID")?.let { majorID = it.toInt() }
        numberValue(map, "minorID")?.let { minorID = it.toInt() }
      }
      ADV_TYPE_EDDY_UID -> KBCfgAdvEddyUID().apply {
        (map["nid"] as? String)?.let { nid = normalizeHexString(it) }
        (map["sid"] as? String)?.let { sid = normalizeHexString(it) }
      }
      ADV_TYPE_EDDY_URL -> KBCfgAdvEddyURL().apply {
        (map["url"] as? String)?.let { url = it }
      }
      ADV_TYPE_EDDY_TLM -> KBCfgAdvEddyTLM()
      ADV_TYPE_SENSOR -> KBCfgAdvKSensor().apply {
        numberValue(map, "aesType")?.let { aesType = it.toInt() }
      }
      ADV_TYPE_EBEACON -> KBCfgAdvEBeacon().apply {
        (map["uuid"] as? String)?.let { uuid = it }
        numberValue(map, "encryptInterval")?.let { encryptInterval = it.toInt() }
        numberValue(map, "aesType")?.let { aesType = it.toInt() }
      }
      ADV_TYPE_UNKNOWN -> newNullAdvertisementConfig()
        ?: throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
      else -> throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
    }

    if (cfg is KBCfgAdvBase) {
      cfg.slotIndex = numberValue(map, "slotIndex")?.toInt()
        ?: throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
      numberValue(map, "txPower")?.let { cfg.txPower = it.toInt() }
      numberValue(map, "advPeriod")?.let { cfg.advPeriod = it.toFloat() }
      numberValue(map, "advMode")?.let { cfg.advMode = it.toInt() }
      (map["advTriggerOnly"] as? Boolean)?.let { cfg.advTriggerOnly = it }
      (map["advConnectable"] as? Boolean)?.let { cfg.advConnectable = it }
    }

    return cfg
  }

  private fun mapTriggerConfig(map: Map<String, Any?>, index: Int): KBCfgTrigger {
    val triggerType = numberValue(map, "triggerType")?.toInt()
      ?: throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
    val cfg = when (triggerType) {
      5 -> KBCfgTriggerMotion().apply {
        numberValue(map, "accODR")?.let { accODR = it.toInt() }
        numberValue(map, "wakeupDuration")?.let { wakeupDuration = it.toInt() }
      }
      14 -> KBCfgTriggerAngle().apply {
        numberValue(map, "aboveAngle")?.let { aboveAngle = it.toInt() }
        numberValue(map, "reportInterval")?.let { reportInterval = it.toInt() }
      }
      else -> KBCfgTrigger()
    }

    cfg.triggerIndex = numberValue(map, "triggerIndex")?.toInt()
      ?: throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
    cfg.triggerType = triggerType
    numberValue(map, "triggerAction")?.let { cfg.triggerAction = it.toInt() }
    numberValue(map, "triggerAdvSlot")?.let { cfg.triggerAdvSlot = it.toInt() }
    numberValue(map, "triggerAdvTime")?.let { cfg.triggerAdvTime = it.toInt() }
    numberValue(map, "triggerPara")?.let { cfg.triggerPara = it.toInt() }
    numberValue(map, "triggerAdvPeriod")?.let { cfg.triggerAdvPeriod = it.toInt() }
    numberValue(map, "triggerTxPower")?.let { cfg.triggerTxPower = it.toInt() }
    numberValue(map, "triggerAdvChangeMode")?.let { cfg.triggerAdvChangeMode = it.toInt() }
    return cfg
  }

  private fun mapSensorConfig(map: Map<String, Any?>, index: Int): KBCfgBase {
    val sensorType = numberValue(map, "sensorType")?.toInt()
      ?: throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
    return when (sensorType) {
      1 -> KBCfgSensorHT().apply {
        (map["logEnable"] as? Boolean)?.let { logEnable = it }
        numberValue(map, "sensorHtMeasureInterval")?.let { sensorHtMeasureInterval = it.toInt() }
        numberValue(map, "humidityChangeThreshold")?.let { humidityChangeThreshold = it.toInt() }
        numberValue(map, "temperatureChangeThreshold")?.let { temperatureChangeThreshold = it.toInt() }
      }
      2 -> KBCfgSensorPIR().apply {
        (map["logEnable"] as? Boolean)?.let { logEnable = it }
        numberValue(map, "measureInterval")?.let { measureInterval = it.toInt() }
        numberValue(map, "logBackoffTime")?.let { logBackoffTime = it.toInt() }
      }
      3 -> KBCfgSensorLight().apply {
        (map["logEnable"] as? Boolean)?.let { logEnable = it }
        numberValue(map, "measureInterval")?.let { measureInterval = it.toInt() }
        numberValue(map, "logChangeThreshold")?.let { logChangeThreshold = it.toInt() }
      }
      5 -> KBCfgSensorGEO().apply {
        (map["parkingTag"] as? Boolean)?.let { parkingTag = it }
        numberValue(map, "parkingThreshold")?.let { parkingThreshold = it.toInt() }
        numberValue(map, "parkingDelay")?.let { parkingDelay = it.toInt() }
      }
      6 -> KBCfgSensorScan().apply {
        numberValue(map, "scanInterval")?.let { scanInterval = it.toInt() }
        numberValue(map, "motionScanInterval")?.let { motionScanInterval = it.toInt() }
        numberValue(map, "scanDuration")?.let { scanDuration = it.toInt() }
        numberValue(map, "scanModel")?.let { scanModel = it.toInt() }
        numberValue(map, "scanRssi")?.let { scanRssi = it.toInt() }
        numberValue(map, "scanChanelMask")?.let { scanChanelMask = it.toInt() }
        numberValue(map, "scanMax")?.let { scanMax = it.toInt() }
        numberValue(map, "scanResultAdvSlot")?.let { scanResultAdvSlot = it.toInt() }
      }
      else -> throw IllegalArgumentException("configuration at index $index is unsupported or malformed")
    }
  }

  private fun newNullAdvertisementConfig(): KBCfgBase? {
    return runCatching {
      Class.forName("com.kkmcn.kbeaconlib2.KBCfgPackage.KBCfgAdvNull")
        .getDeclaredConstructor()
        .newInstance() as? KBCfgBase
    }.getOrNull()
  }

  private fun numberValue(map: Map<String, Any?>, key: String): Number? {
    return map[key] as? Number
  }

  private fun integerLongValue(map: Map<String, Any?>, key: String): Long? {
    val value = numberValue(map, key) ?: return null
    val doubleValue = value.toDouble()
    if (!java.lang.Double.isFinite(doubleValue) || doubleValue % 1.0 != 0.0) {
      return null
    }

    return value.toLong()
  }

  private fun isSupportedSensorType(sensorType: Int): Boolean {
    return sensorType in 1..7
  }

  private fun isSupportedReadOption(readOption: Int): Boolean {
    return readOption == KBSensorReadOption.NormalOrder ||
      readOption == KBSensorReadOption.ReverseOrder ||
      readOption == KBSensorReadOption.NewRecord
  }

  private fun valueFromMethod(target: Any, methodName: String): Any? {
    return runCatching { target.javaClass.getMethod(methodName).invoke(target) }.getOrNull()
  }

  private fun firstValueFromMethods(target: Any, vararg methodNames: String): Any? {
    methodNames.forEach { methodName ->
      valueFromMethod(target, methodName)?.let { return it }
    }
    return null
  }

  private fun numberFromMethods(target: Any, vararg methodNames: String): Number? {
    return firstValueFromMethods(target, *methodNames) as? Number
  }

  private fun booleanFromMethods(target: Any, vararg methodNames: String): Boolean? {
    return firstValueFromMethods(target, *methodNames) as? Boolean
  }

  private fun stringFromMethods(target: Any, vararg methodNames: String): String? {
    return firstValueFromMethods(target, *methodNames) as? String
  }

  private fun sensorRecordToMap(record: Any, sensorType: Int): Map<String, Any?> {
    val map = mutableMapOf<String, Any?>("sensorType" to sensorType)
    runCatching { map["utcTime"] = record.javaClass.getField("utcTime").get(record) }
    runCatching { map["temperature"] = record.javaClass.getField("temperature").get(record) }
    runCatching { map["humidity"] = record.javaClass.getField("humidity").get(record) }
    runCatching { map["luxValue"] = record.javaClass.getField("luxValue").get(record) }
    runCatching { map["pirIndication"] = record.javaClass.getField("pirIndication").get(record) }
    runCatching { map["alarmStatus"] = record.javaClass.getField("alarmStatus").get(record) }
    runCatching {
      val data = record.javaClass.getField("data").get(record)
      if (data is ByteArray) map["raw"] = data.map { it.toInt() and 0xff }
    }
    runCatching {
      val raw = record.javaClass.getField("raw").get(record)
      if (raw is ByteArray) map["raw"] = raw.map { it.toInt() and 0xff }
    }
    return map.filterValues { it != null }
  }

  private fun deviceSnapshot(beacon: KBeacon): Map<String, Any?> {
    val normalized = normalizedMac(beacon.mac)
    val snapshot = mutableMapOf<String, Any?>("macAddress" to normalized)

    valueFromMethod(beacon, "getCommonCfg")?.let { commonCfg ->
      snapshot["common"] = commonConfigToMap(commonCfg)
    }

    val slotCfgList = valueFromMethod(beacon, "getSlotCfgList")
    if (slotCfgList is Iterable<*>) {
      snapshot["slots"] = slotCfgList.mapNotNull { slotCfg ->
        slotCfg?.let { slotConfigToMap(it) }
      }
    }

    val triggerCfgList = valueFromMethod(beacon, "getTriggerCfgList")
    if (triggerCfgList is Iterable<*>) {
      snapshot["triggers"] = triggerCfgList.mapNotNull { triggerCfg ->
        triggerCfg?.let { triggerConfigToMap(it) }
      }
    }

    val sensorCfgList = valueFromMethod(beacon, "getSensorCfgList")
    if (sensorCfgList is Iterable<*>) {
      snapshot["sensors"] = sensorCfgList.mapNotNull { sensorCfg ->
        sensorCfg?.let { sensorConfigToMap(it) }
      }
    }

    return snapshot.filterValues { it != null }
  }

  private fun commonConfigToMap(commonCfg: Any): Map<String, Any?> {
    return mapOf(
      "name" to stringFromMethods(commonCfg, "getName"),
      "model" to stringFromMethods(commonCfg, "getModel"),
      "version" to stringFromMethods(commonCfg, "getVersion"),
      "hardwareVersion" to stringFromMethods(commonCfg, "getHardwareVersion"),
      "maxSlots" to numberFromMethods(commonCfg, "getMaxSlot")?.toInt(),
      "maxTriggers" to numberFromMethods(commonCfg, "getMaxTrigger")?.toInt(),
      "minTxPower" to numberFromMethods(commonCfg, "getMinTxPower")?.toInt(),
      "maxTxPower" to numberFromMethods(commonCfg, "getMaxTxPower")?.toInt(),
      "supportsIBeacon" to booleanFromMethods(commonCfg, "isSupportIBeacon"),
      "supportsEddyUid" to booleanFromMethods(commonCfg, "isSupportEddyUID"),
      "supportsEddyUrl" to booleanFromMethods(commonCfg, "isSupportEddyURL"),
      "supportsEddyTlm" to booleanFromMethods(commonCfg, "isSupportEddyTLM"),
      "supportsSensorAdvertisement" to booleanFromMethods(commonCfg, "isSupportKBSensor"),
      "supportsSystemAdvertisement" to booleanFromMethods(commonCfg, "isSupportKBSystem"),
      "supportsButton" to booleanFromMethods(commonCfg, "isSupportButton"),
      "supportsBeep" to booleanFromMethods(commonCfg, "isSupportBeep"),
      "supportsAccelerometer" to booleanFromMethods(commonCfg, "isSupportAccSensor"),
      "supportsHumidity" to booleanFromMethods(commonCfg, "isSupportHumiditySensor"),
      "supportsPir" to booleanFromMethods(commonCfg, "isSupportPIRSensor"),
      "supportsLight" to booleanFromMethods(commonCfg, "isSupportLightSensor")
    ).filterValues { it != null }
  }

  private fun slotConfigToMap(slotCfg: Any): Map<String, Any?> {
    val advType = numberFromMethods(slotCfg, "getAdvType")?.toInt()
      ?: advTypeFromConfigClass(slotCfg)
    val map = mutableMapOf<String, Any?>(
      "configType" to "advertisement",
      "slotIndex" to numberFromMethods(slotCfg, "getSlotIndex")?.toInt(),
      "advType" to advType,
      "txPower" to numberFromMethods(slotCfg, "getTxPower")?.toInt(),
      "advPeriod" to numberFromMethods(slotCfg, "getAdvPeriod")?.toDouble(),
      "advMode" to numberFromMethods(slotCfg, "getAdvMode")?.toInt(),
      "advTriggerOnly" to booleanFromMethods(slotCfg, "isAdvTriggerOnly", "getAdvTriggerOnly"),
      "advConnectable" to booleanFromMethods(slotCfg, "isAdvConnectable", "getAdvConnectable")
    )

    when (advType) {
      ADV_TYPE_IBEACON -> {
        map["uuid"] = stringFromMethods(slotCfg, "getUuid", "getUUID")
        map["majorID"] = numberFromMethods(slotCfg, "getMajorID")?.toInt()
        map["minorID"] = numberFromMethods(slotCfg, "getMinorID")?.toInt()
      }
      ADV_TYPE_EDDY_UID -> {
        map["nid"] = normalizeHexString(stringFromMethods(slotCfg, "getNid", "getNID"))
        map["sid"] = normalizeHexString(stringFromMethods(slotCfg, "getSid", "getSID"))
      }
      ADV_TYPE_EDDY_URL -> map["url"] = stringFromMethods(slotCfg, "getUrl", "getURL")
      ADV_TYPE_EBEACON -> {
        map["uuid"] = stringFromMethods(slotCfg, "getUuid", "getUUID")
        map["encryptInterval"] = numberFromMethods(slotCfg, "getEncryptInterval")?.toInt()
        map["aesType"] = numberFromMethods(slotCfg, "getAesType", "getAESType")?.toInt()
      }
      ADV_TYPE_SENSOR -> map["aesType"] = numberFromMethods(slotCfg, "getAesType", "getAESType")?.toInt()
    }

    return map.filterValues { it != null }
  }

  private fun advTypeFromConfigClass(slotCfg: Any): Int {
    val className = slotCfg.javaClass.simpleName
    return when {
      className.contains("IBeacon") -> ADV_TYPE_IBEACON
      className.contains("EddyUID") -> ADV_TYPE_EDDY_UID
      className.contains("EddyURL") -> ADV_TYPE_EDDY_URL
      className.contains("EddyTLM") -> ADV_TYPE_EDDY_TLM
      className.contains("KSensor") -> ADV_TYPE_SENSOR
      className.contains("EBeacon") -> ADV_TYPE_EBEACON
      else -> ADV_TYPE_UNKNOWN
    }
  }

  private fun triggerConfigToMap(triggerCfg: Any): Map<String, Any?> {
    return mapOf(
      "configType" to "trigger",
      "triggerIndex" to numberFromMethods(triggerCfg, "getTriggerIndex")?.toInt(),
      "triggerType" to numberFromMethods(triggerCfg, "getTriggerType")?.toInt(),
      "triggerAction" to numberFromMethods(triggerCfg, "getTriggerAction")?.toInt(),
      "triggerAdvSlot" to numberFromMethods(triggerCfg, "getTriggerAdvSlot")?.toInt(),
      "triggerAdvTime" to numberFromMethods(triggerCfg, "getTriggerAdvTime")?.toInt(),
      "triggerPara" to numberFromMethods(triggerCfg, "getTriggerPara")?.toInt(),
      "triggerAdvPeriod" to numberFromMethods(triggerCfg, "getTriggerAdvPeriod")?.toInt(),
      "triggerTxPower" to numberFromMethods(triggerCfg, "getTriggerAdvTxPower", "getTriggerTxPower")?.toInt(),
      "triggerAdvChangeMode" to numberFromMethods(triggerCfg, "getTriggerAdvChangeMode")?.toInt(),
      "accODR" to numberFromMethods(triggerCfg, "getAccODR")?.toInt(),
      "wakeupDuration" to numberFromMethods(triggerCfg, "getWakeupDuration")?.toInt(),
      "aboveAngle" to numberFromMethods(triggerCfg, "getAboveAngle")?.toInt(),
      "reportInterval" to numberFromMethods(triggerCfg, "getReportingInterval", "getReportInterval")?.toInt()
    ).filterValues { it != null }
  }

  private fun sensorConfigToMap(sensorCfg: Any): Map<String, Any?> {
    return mapOf(
      "configType" to "sensor",
      "sensorType" to numberFromMethods(sensorCfg, "getSensorType")?.toInt(),
      "logEnable" to booleanFromMethods(sensorCfg, "isLogEnable", "getLogEnable"),
      "sensorHtMeasureInterval" to numberFromMethods(sensorCfg, "getSensorHtMeasureInterval")?.toInt(),
      "humidityChangeThreshold" to numberFromMethods(sensorCfg, "getHumidityChangeThreshold")?.toInt(),
      "temperatureChangeThreshold" to numberFromMethods(sensorCfg, "getTemperatureChangeThreshold")?.toInt(),
      "measureInterval" to numberFromMethods(sensorCfg, "getMeasureInterval")?.toInt(),
      "logChangeThreshold" to numberFromMethods(sensorCfg, "getLogChangeThreshold")?.toInt(),
      "parkingTag" to booleanFromMethods(sensorCfg, "isParkingTag", "getParkingTag"),
      "parkingThreshold" to numberFromMethods(sensorCfg, "getParkingThreshold")?.toInt(),
      "parkingDelay" to numberFromMethods(sensorCfg, "getParkingDelay")?.toInt(),
      "scanInterval" to numberFromMethods(sensorCfg, "getScanInterval")?.toInt(),
      "motionScanInterval" to numberFromMethods(sensorCfg, "getMotionScanInterval")?.toInt(),
      "scanDuration" to numberFromMethods(sensorCfg, "getScanDuration")?.toInt(),
      "scanModel" to numberFromMethods(sensorCfg, "getScanModel")?.toInt(),
      "scanRssi" to numberFromMethods(sensorCfg, "getScanRssi")?.toInt(),
      "scanChanelMask" to numberFromMethods(sensorCfg, "getScanChanelMask")?.toInt(),
      "scanMax" to numberFromMethods(sensorCfg, "getScanMax")?.toInt(),
      "scanResultAdvSlot" to numberFromMethods(sensorCfg, "getScanResultAdvSlot")?.toInt(),
      "logBackoffTime" to numberFromMethods(sensorCfg, "getLogBackoffTime")?.toInt()
    ).filterValues { it != null }
  }

  private fun sendConnectionState(macAddress: String, state: KBConnState, reason: Int) {
    sendEvent(
      "onConnectionStateChanged",
      mapOf(
        "macAddress" to normalizedMac(macAddress),
        "state" to connectionStateToInt(state),
        "reason" to reason
      )
    )
  }

  private fun connectionStateToInt(state: KBConnState): Int {
    return when (state.toString()) {
      "Disconnected" -> 0
      "Connecting" -> 1
      "Connected" -> 2
      "Disconnecting" -> 3
      else -> 0
    }
  }

  private fun capabilitiesMap(): Map<String, Any> {
    return mapOf(
      "transport" to "ble",
      "supportsScanning" to true,
      "supportsConnection" to true,
      "supportsConfiguration" to true,
      "supportsEnhancedConnection" to true,
      "supportsSensorHistory" to true,
      "supportsNotifications" to true,
      "supportsDfu" to false
    )
  }

  private fun currentPermissionStatus(): Map<String, Any?> {
    val context = appContext.reactContext
    if (context == null || !hasBluetoothSupport(context)) {
      return mapOf("bluetooth" to "unavailable", "canAskAgain" to false)
    }

    val bluetoothStatus = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      aggregatePermissionStatus(context, bluetoothRuntimePermissions())
    } else {
      "granted"
    }

    val locationStatus = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      aggregatePermissionStatus(context, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION))
    } else {
      null
    }

    return mutableMapOf<String, Any?>(
      "bluetooth" to bluetoothStatus,
      "canAskAgain" to true
    ).apply {
      locationStatus?.let { put("location", it) }
    }
  }

  private fun permissionStatusFromResponses(
    responses: MutableMap<String, PermissionsResponse>
  ): Map<String, Any?> {
    val bluetoothStatus = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      aggregatePermissionStatus(responses, bluetoothRuntimePermissions())
    } else {
      "granted"
    }
    val locationStatus = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      aggregatePermissionStatus(responses, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION))
    } else {
      null
    }
    val canAskAgain = responses.values.all { it.canAskAgain }

    return mutableMapOf<String, Any?>(
      "bluetooth" to bluetoothStatus,
      "canAskAgain" to canAskAgain
    ).apply {
      locationStatus?.let { put("location", it) }
    }
  }

  private fun aggregatePermissionStatus(context: Context, permissions: Array<String>): String {
    if (permissions.isEmpty()) return "granted"
    return if (permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
      "granted"
    } else {
      "denied"
    }
  }

  private fun aggregatePermissionStatus(
    responses: MutableMap<String, PermissionsResponse>,
    permissions: Array<String>
  ): String {
    if (permissions.isEmpty()) return "granted"
    val statuses = permissions.mapNotNull { responses[it]?.status }
    return when {
      statuses.isNotEmpty() && statuses.all { it == PermissionsStatus.GRANTED } -> "granted"
      statuses.any { it == PermissionsStatus.DENIED } -> "denied"
      else -> "undetermined"
    }
  }

  private fun runtimePermissionsForPlatform(): Array<String> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      bluetoothRuntimePermissions()
    } else {
      arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }
  }

  private fun bluetoothRuntimePermissions(): Array<String> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    } else {
      emptyArray()
    }
  }

  private fun hasRequiredRuntimePermissions(context: Context): Boolean {
    return runtimePermissionsForPlatform().all {
      ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun hasBluetoothSupport(context: Context): Boolean {
    return context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) ||
      context.getSystemService(BluetoothManager::class.java)?.adapter != null
  }

  private fun isBluetoothEnabled(context: Context): Boolean {
    val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter ?: BluetoothAdapter.getDefaultAdapter()
    return adapter?.isEnabled == true
  }

  private fun androidBleStateToString(state: Int): String {
    return when (state) {
      KBeaconsMgr.BLEStatePowerOn -> "poweredOn"
      KBeaconsMgr.BLEStatePowerOff -> "poweredOff"
      KBeaconsMgr.BLEStateUnknown -> "unknown"
      else -> "unknown"
    }
  }

  private fun rejectAndEmit(
    promise: Promise,
    code: String,
    message: String,
    macAddress: String? = null
  ) {
    sendEvent(
      "onError",
      mapOf(
        "code" to code,
        "message" to message,
        "macAddress" to macAddress
      ).filterValues { it != null }
    )
    promise.reject(code, message, null)
  }
}
