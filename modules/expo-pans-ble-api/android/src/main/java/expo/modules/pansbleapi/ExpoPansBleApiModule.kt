package expo.modules.pansbleapi

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.ArrayDeque
import java.util.UUID

class ExpoPansBleApiModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  private val discoveredDevices = mutableMapOf<String, BluetoothDevice>()
  private val discoveredMetadata = mutableMapOf<String, Map<String, Any?>>()
  private val connections = mutableMapOf<String, ConnectionContext>()
  private var scanner: BluetoothLeScanner? = null
  private var isScanning = false
  private var hasRequestedPermissions = false
  private var pendingPermissionPromise: Promise? = null
  private var nextOperationId = 1L

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      handleScanResult(result)
    }

    override fun onBatchScanResults(results: MutableList<ScanResult>) {
      results.forEach { handleScanResult(it) }
    }

    override fun onScanFailed(errorCode: Int) {
      isScanning = false
      emitError("OPERATION_FAILED", "BLE scan failed with code $errorCode")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoPansBleApi")

    Events(
      "onDeviceDiscovered",
      "onConnectionStateChanged",
      "onCharacteristicNotification",
      "onError"
    )

    OnDestroy {
      stopScanSafely()
      pendingPermissionPromise?.reject(
        "OPERATION_FAILED",
        "Module destroyed while awaiting permission result.",
        null
      )
      pendingPermissionPromise = null
      connections.keys.toList().forEach { closeConnection(it, "module destroyed", rejectConnect = true) }
      discoveredDevices.clear()
      discoveredMetadata.clear()
    }

    AsyncFunction("startScanning") { promise: Promise ->
      try {
        val adapter = bluetoothAdapter()
        if (adapter == null || !adapter.isEnabled) {
          promise.reject("BLUETOOTH_UNAVAILABLE", "Bluetooth is unavailable or disabled.", null)
          return@AsyncFunction
        }
        if (!hasRequiredPermissions()) {
          promise.reject("PERMISSION_DENIED", "Bluetooth scan/connect permissions are not granted.", null)
          return@AsyncFunction
        }
        if (isScanning) {
          promise.resolve(null)
          return@AsyncFunction
        }

        val scan = adapter.bluetoothLeScanner
        if (scan == null) {
          promise.reject("BLUETOOTH_UNAVAILABLE", "Bluetooth LE scanner is unavailable.", null)
          return@AsyncFunction
        }

        scanner = scan
        val settings = ScanSettings.Builder()
          .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
          .build()
        scan.startScan(null, settings, scanCallback)
        isScanning = true
        promise.resolve(null)
      } catch (error: SecurityException) {
        promise.reject("PERMISSION_DENIED", error.message ?: "Bluetooth permission denied.", error)
      } catch (error: Throwable) {
        promise.reject("OPERATION_FAILED", error.message ?: "Unable to start BLE scan.", error)
      }
    }

    Function("stopScanning") {
      stopScanSafely()
    }

    Function("clearDevices") {
      discoveredDevices.clear()
      discoveredMetadata.clear()
    }

    Function("getCapabilities") {
      PansBleApiConstants.androidCapabilities
    }

    Function("getPermissionStatus") {
      permissionStatusMap()
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(
          "OPERATION_FAILED",
          "Cannot request Bluetooth permissions without a foreground activity.",
          null
        )
        return@AsyncFunction
      }

      val missing = requiredPermissions().filter {
        activity.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
      }

      if (missing.isEmpty()) {
        promise.resolve(permissionStatusMap())
        return@AsyncFunction
      }

      pendingPermissionPromise?.reject(
        "OPERATION_FAILED",
        "A newer permission request replaced the previous request.",
        null
      )
      pendingPermissionPromise = promise
      hasRequestedPermissions = true

      val permissions = appContext.permissions
      if (permissions == null) {
        pendingPermissionPromise = null
        promise.reject("OPERATION_FAILED", "Expo permissions service is unavailable.", null)
        return@AsyncFunction
      }

      permissions.askForPermissions(
        {
          pendingPermissionPromise?.resolve(permissionStatusMap())
          pendingPermissionPromise = null
        },
        *missing.toTypedArray()
      )
    }

    AsyncFunction("connect") { deviceId: String, timeoutMs: Int?, promise: Promise ->
      try {
        if (timeoutMs != null && timeoutMs <= 0) {
          promise.reject("INVALID_ARGUMENT", "timeoutMs must be a positive integer.", null)
          return@AsyncFunction
        }

        val normalized = normalizeDeviceId(deviceId)
        val device = discoveredDevices[normalized] ?: bluetoothAdapter()?.getRemoteDeviceOrNull(normalized)
        if (device == null) {
          promise.reject("DEVICE_NOT_FOUND", "Device $deviceId has not been discovered.", null)
          return@AsyncFunction
        }
        if (!hasRequiredPermissions()) {
          promise.reject("PERMISSION_DENIED", "Bluetooth connect permission is not granted.", null)
          return@AsyncFunction
        }

        connections[normalized]?.let {
          if (it.state == "connected") {
            promise.resolve(true)
            return@AsyncFunction
          }
          closeConnection(normalized, "reconnecting", rejectConnect = true)
        }

        val context = appContext.reactContext ?: appContext.currentActivity
        if (context == null) {
          promise.reject("OPERATION_FAILED", "Android context is unavailable.", null)
          return@AsyncFunction
        }

        val connection = ConnectionContext(normalized)
        connection.pendingConnectPromise = promise
        connections[normalized] = connection
        sendConnectionState(normalized, "connecting", null)

        connection.connectTimeoutRunnable = Runnable {
          if (connection.pendingConnectPromise == null) return@Runnable
          connection.pendingConnectPromise?.reject("TIMEOUT", "Timed out connecting to $deviceId.", null)
          connection.pendingConnectPromise = null
          closeConnection(normalized, "timeout", rejectConnect = true)
        }
        mainHandler.postDelayed(connection.connectTimeoutRunnable!!, (timeoutMs ?: 15000).toLong())

        val gatt = try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
          } else {
            device.connectGatt(context, false, gattCallback)
          }
        } catch (error: SecurityException) {
          failImmediateConnect(
            normalized,
            connection,
            null,
            promise,
            "PERMISSION_DENIED",
            error.message ?: "Bluetooth permission denied.",
            error
          )
          return@AsyncFunction
        } catch (error: Throwable) {
          failImmediateConnect(
            normalized,
            connection,
            null,
            promise,
            "OPERATION_FAILED",
            error.message ?: "Unable to connect.",
            error
          )
          return@AsyncFunction
        }

        if (gatt == null) {
          failImmediateConnect(
            normalized,
            connection,
            null,
            promise,
            "OPERATION_FAILED",
            "connectGatt returned null.",
            null
          )
          return@AsyncFunction
        }

        connection.bluetoothGatt = gatt
      } catch (error: IllegalArgumentException) {
        promise.reject("INVALID_ARGUMENT", error.message ?: "Invalid device ID.", error)
      } catch (error: SecurityException) {
        promise.reject("PERMISSION_DENIED", error.message ?: "Bluetooth permission denied.", error)
      } catch (error: Throwable) {
        promise.reject("OPERATION_FAILED", error.message ?: "Unable to connect.", error)
      }
    }

    AsyncFunction("disconnect") { deviceId: String, promise: Promise ->
      closeConnection(normalizeDeviceId(deviceId), "local disconnect", rejectConnect = false)
      promise.resolve(true)
    }

    AsyncFunction("readCharacteristic") { deviceId: String, characteristicUuid: String, promise: Promise ->
      val operation = GattOperation.Read(allocateOperationId(), parseUuid(characteristicUuid), promise)
      enqueue(normalizeDeviceId(deviceId), operation)
    }

    AsyncFunction("writeCharacteristic") { deviceId: String, characteristicUuid: String, payload: List<Int>, writeType: String?, promise: Promise ->
      val bytes = validatePayload(payload)
      val type = normalizeWriteType(writeType)
      val operation = GattOperation.Write(allocateOperationId(), parseUuid(characteristicUuid), bytes, type, promise)
      enqueue(normalizeDeviceId(deviceId), operation)
    }

    AsyncFunction("setCharacteristicNotifications") { deviceId: String, characteristicUuid: String, enabled: Boolean, promise: Promise ->
      val operation = GattOperation.Notify(allocateOperationId(), parseUuid(characteristicUuid), enabled, promise)
      enqueue(normalizeDeviceId(deviceId), operation)
    }

    AsyncFunction("requestMtu") { deviceId: String, mtu: Int, promise: Promise ->
      if (mtu !in 23..517) {
        promise.reject("INVALID_ARGUMENT", "MTU must be in range 23..517.", null)
        return@AsyncFunction
      }
      enqueue(normalizeDeviceId(deviceId), GattOperation.Mtu(allocateOperationId(), mtu, promise))
    }
  }

  private val gattCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      val deviceId = normalizeDeviceId(gatt.device.address)
      val context = connectionFor(gatt) ?: return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        context.pendingConnectPromise?.reject("GATT_ERROR", "GATT connection failed with status $status.", null)
        context.pendingConnectPromise = null
        closeConnection(deviceId, "gatt status $status", rejectConnect = true)
        return
      }
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        context.state = "discovering"
        try {
          val started = gatt.discoverServices()
          if (!started) {
            context.pendingConnectPromise?.reject(
              "OPERATION_FAILED",
              "Failed to start GATT service discovery.",
              null
            )
            context.pendingConnectPromise = null
            closeConnection(deviceId, "service discovery did not start", rejectConnect = true)
          }
        } catch (error: SecurityException) {
          context.pendingConnectPromise?.reject("PERMISSION_DENIED", error.message ?: "Bluetooth permission denied.", error)
          context.pendingConnectPromise = null
          closeConnection(deviceId, "service discovery permission denied", rejectConnect = true)
        }
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        closeConnection(deviceId, "remote disconnect", rejectConnect = true)
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val deviceId = normalizeDeviceId(gatt.device.address)
      val context = connectionFor(gatt) ?: return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        context.pendingConnectPromise?.reject("GATT_ERROR", "Service discovery failed with status $status.", null)
        context.pendingConnectPromise = null
        closeConnection(deviceId, "service discovery failed", rejectConnect = true)
        return
      }

      val pansService = gatt.getService(PansBleApiConstants.pansServiceUuid)
      if (pansService == null) {
        context.pendingConnectPromise?.reject("SERVICE_NOT_FOUND", "PANS network-node service was not discovered.", null)
        context.pendingConnectPromise = null
        closeConnection(deviceId, "service missing", rejectConnect = true)
        return
      }

      cacheCharacteristics(context, pansService)
      gatt.getService(PansBleApiConstants.gapServiceUuid)?.let { cacheCharacteristics(context, it) }

      val missing = PansBleApiCodec.missingRequiredCharacteristics(context.characteristics.keys)
      if (missing.isNotEmpty()) {
        context.pendingConnectPromise?.reject(
          "CHARACTERISTIC_NOT_FOUND",
          "PANS service is missing required characteristics: ${missing.joinToString()}.",
          null
        )
        context.pendingConnectPromise = null
        closeConnection(deviceId, "required characteristics missing", rejectConnect = true)
        return
      }

      context.state = "connected"
      context.connectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
      context.connectTimeoutRunnable = null
      context.pendingConnectPromise?.resolve(true)
      context.pendingConnectPromise = null
      sendConnectionState(deviceId, "connected", null)
    }

    @Deprecated("Deprecated in Android 13")
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      onCharacteristicReadValue(gatt, characteristic, characteristic.value ?: ByteArray(0), status)
    }

    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
      onCharacteristicReadValue(gatt, characteristic, value, status)
    }

    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      connectionFor(gatt)?.let { context ->
        finishWrite(context, characteristic.uuid, status)
      }
    }

    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      connectionFor(gatt)?.let { context ->
        finishNotify(context, descriptor, status)
      }
    }

    @Deprecated("Deprecated in Android 13")
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      emitCharacteristicChanged(gatt, characteristic, characteristic.value ?: ByteArray(0))
    }

    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
      emitCharacteristicChanged(gatt, characteristic, value)
    }

    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      connectionFor(gatt)?.let { context ->
        finishMtu(context, mtu, status)
      }
    }
  }

  private fun onCharacteristicReadValue(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
    connectionFor(gatt)?.let { context ->
      finishRead(context, characteristic.uuid, status, value)
    }
  }

  private fun emitCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
    val context = connectionFor(gatt) ?: return
    val deviceId = context.deviceId
    sendEvent("onCharacteristicNotification", mapOf(
      "deviceId" to deviceId,
      "macAddress" to deviceId,
      "characteristicUuid" to characteristic.uuid.toString().lowercase(),
      "payload" to value.map { it.toInt() and 0xff }
    ))
  }

  private fun handleScanResult(result: ScanResult) {
    val serviceData = extractPansServiceData(result) ?: return
    val device = result.device ?: return
    val deviceId = normalizeDeviceId(device.address)
    val record = result.scanRecord
    val metadata = mapOf(
      "deviceId" to deviceId,
      "macAddress" to device.address,
      "mac" to device.address,
      "name" to (record?.deviceName ?: device.name),
      "rssi" to result.rssi,
      "lastSeenMs" to System.currentTimeMillis().toDouble(),
      "presence" to PansBleApiCodec.decodePresence(serviceData)
    )
    discoveredDevices[deviceId] = device
    discoveredMetadata[deviceId] = metadata
    sendEvent("onDeviceDiscovered", mapOf("devices" to discoveredMetadata.values.toList()))
  }

  private fun extractPansServiceData(result: ScanResult): ByteArray? {
    val serviceData = result.scanRecord?.getServiceData(ParcelUuid(PansBleApiConstants.pansServiceUuid)) ?: return null
    return PansBleApiCodec.validPansServiceData(serviceData)
  }

  private fun enqueue(deviceId: String, operation: GattOperation) {
    val context = connections[deviceId]
    if (context == null || context.state != "connected" || context.isClosed) {
      operation.promise.reject("NOT_CONNECTED", "Device $deviceId is not connected.", null)
      return
    }
    context.queue.add(operation)
    if (context.activeOperation == null) startNextOperation(context)
  }

  private fun startNextOperation(context: ConnectionContext) {
    if (context.isClosed || context.activeOperation != null) return
    val operation = context.queue.poll() ?: return
    val gatt = context.bluetoothGatt
    if (gatt == null) {
      operation.promise.reject("NOT_CONNECTED", "GATT client is not available.", null)
      closeConnection(context.deviceId, "gatt unavailable", rejectConnect = true)
      return
    }

    context.activeOperation = operation
    context.activeOperationTimeoutRunnable = Runnable {
      val active = context.activeOperation
      if (connections[context.deviceId] !== context) return@Runnable
      if (active?.id != operation.id) return@Runnable
      context.activeOperation = null
      context.activeOperationTimeoutRunnable = null
      active.promise.reject("TIMEOUT", "GATT operation timed out.", null)
      closeConnection(context.deviceId, "gatt operation timeout", rejectConnect = true)
    }
    mainHandler.postDelayed(context.activeOperationTimeoutRunnable!!, 10_000)

    val result = try {
      when (operation) {
        is GattOperation.Read -> startRead(context, gatt, operation)
        is GattOperation.Write -> startWrite(context, gatt, operation)
        is GattOperation.Notify -> startNotify(context, gatt, operation)
        is GattOperation.Mtu -> if (gatt.requestMtu(operation.mtu)) StartResult.Started else StartResult.Failed("OPERATION_FAILED", "Failed to start MTU request.")
      }
    } catch (error: SecurityException) {
      StartResult.Failed("PERMISSION_DENIED", error.message ?: "Bluetooth permission denied.")
    }

    if (result is StartResult.Failed) {
      clearActiveOperation(context)
      operation.promise.reject(result.code, result.message, null)
      startNextOperation(context)
    }
  }

  private fun startRead(context: ConnectionContext, gatt: BluetoothGatt, operation: GattOperation.Read): StartResult {
    val characteristic = context.characteristics[operation.uuid]
      ?: return StartResult.Failed("CHARACTERISTIC_NOT_FOUND", "Characteristic ${operation.uuid} was not discovered.")
    return if (gatt.readCharacteristic(characteristic)) StartResult.Started else StartResult.Failed("OPERATION_FAILED", "Failed to start characteristic read.")
  }

  private fun startWrite(context: ConnectionContext, gatt: BluetoothGatt, operation: GattOperation.Write): StartResult {
    val characteristic = context.characteristics[operation.uuid]
      ?: return StartResult.Failed("CHARACTERISTIC_NOT_FOUND", "Characteristic ${operation.uuid} was not discovered.")
    characteristic.writeType = operation.writeType
    val started = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      gatt.writeCharacteristic(characteristic, operation.payload, operation.writeType) == BluetoothGatt.GATT_SUCCESS
    } else {
      @Suppress("DEPRECATION")
      characteristic.value = operation.payload
      @Suppress("DEPRECATION")
      gatt.writeCharacteristic(characteristic)
    }
    return if (started) {
      StartResult.Started
    } else {
      StartResult.Failed("OPERATION_FAILED", "Failed to start characteristic write.")
    }
  }

  private fun connectionFor(gatt: BluetoothGatt): ConnectionContext? {
    val deviceId = normalizeDeviceId(gatt.device.address)
    val context = connections[deviceId] ?: return null

    return context.takeIf {
      !it.isClosed && it.bluetoothGatt === gatt
    }
  }

  private fun startNotify(context: ConnectionContext, gatt: BluetoothGatt, operation: GattOperation.Notify): StartResult {
    val characteristic = context.characteristics[operation.uuid]
      ?: return StartResult.Failed("CHARACTERISTIC_NOT_FOUND", "Characteristic ${operation.uuid} was not discovered.")
    val previousLocalState = context.notificationStates[operation.uuid] ?: false
    context.activeNotifyPreviousLocalState = previousLocalState
    if (!gatt.setCharacteristicNotification(characteristic, operation.enabled)) {
      return StartResult.Failed("OPERATION_FAILED", "Failed to set local notification state.")
    }
    val descriptor = characteristic.getDescriptor(PansBleApiConstants.cccdUuid)
    if (descriptor == null) {
      rollbackLocalNotificationState(gatt, characteristic, previousLocalState)
      return StartResult.Failed("CHARACTERISTIC_NOT_FOUND", "CCCD descriptor was not found for ${operation.uuid}.")
    }
    val enabledValue = if (!operation.enabled) {
      BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
    } else if ((characteristic.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) {
      BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
    } else {
      BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
    }
    val started = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      gatt.writeDescriptor(descriptor, enabledValue) == BluetoothGatt.GATT_SUCCESS
    } else {
      @Suppress("DEPRECATION")
      descriptor.value = enabledValue
      @Suppress("DEPRECATION")
      gatt.writeDescriptor(descriptor)
    }
    return if (started) {
      StartResult.Started
    } else {
      rollbackLocalNotificationState(gatt, characteristic, previousLocalState)
      StartResult.Failed("OPERATION_FAILED", "Failed to write CCCD descriptor.")
    }
  }

  private fun finishRead(context: ConnectionContext, characteristicUuid: UUID, status: Int, value: ByteArray) {
    val operation = context.activeOperation as? GattOperation.Read ?: return
    if (operation.uuid != characteristicUuid) return
    clearActiveOperation(context)
    if (status == BluetoothGatt.GATT_SUCCESS) {
      operation.promise.resolve(value.map { it.toInt() and 0xff })
    } else {
      operation.promise.reject("GATT_ERROR", "Characteristic read failed with status $status.", null)
    }
    startNextOperation(context)
  }

  private fun finishWrite(context: ConnectionContext, characteristicUuid: UUID, status: Int) {
    val operation = context.activeOperation as? GattOperation.Write ?: return
    if (operation.uuid != characteristicUuid) return
    clearActiveOperation(context)
    if (status == BluetoothGatt.GATT_SUCCESS) {
      operation.promise.resolve(true)
    } else {
      operation.promise.reject("GATT_ERROR", "Characteristic write failed with status $status.", null)
    }
    startNextOperation(context)
  }

  private fun finishNotify(context: ConnectionContext, descriptor: BluetoothGattDescriptor, status: Int) {
    val operation = context.activeOperation as? GattOperation.Notify ?: return
    if (descriptor.characteristic.uuid != operation.uuid) return
    val previousLocalState = context.activeNotifyPreviousLocalState ?: false
    clearActiveOperation(context)
    if (status == BluetoothGatt.GATT_SUCCESS) {
      context.notificationStates[operation.uuid] = operation.enabled
      operation.promise.resolve(true)
    } else {
      context.bluetoothGatt?.let { rollbackLocalNotificationState(it, descriptor.characteristic, previousLocalState) }
      operation.promise.reject("GATT_ERROR", "Descriptor write failed with status $status.", null)
    }
    startNextOperation(context)
  }

  private fun finishMtu(context: ConnectionContext, mtu: Int, status: Int) {
    val operation = context.activeOperation as? GattOperation.Mtu ?: return
    clearActiveOperation(context)
    if (status == BluetoothGatt.GATT_SUCCESS) {
      operation.promise.resolve(mtu)
    } else {
      operation.promise.reject("GATT_ERROR", "MTU request failed with status $status.", null)
    }
    startNextOperation(context)
  }

  private fun clearActiveOperation(context: ConnectionContext) {
    context.activeOperationTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    context.activeOperationTimeoutRunnable = null
    context.activeOperation = null
    context.activeNotifyPreviousLocalState = null
  }

  private fun failImmediateConnect(
    deviceId: String,
    context: ConnectionContext,
    gatt: BluetoothGatt?,
    promise: Promise,
    code: String,
    message: String,
    cause: Throwable?
  ) {
    if (connections[deviceId] === context) {
      connections.remove(deviceId)
    }
    context.connectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    context.connectTimeoutRunnable = null
    context.pendingConnectPromise = null
    context.isClosed = true
    try {
      gatt?.close()
    } catch (_: SecurityException) {
    }
    promise.reject(code, message, cause)
    sendConnectionState(deviceId, "disconnected", message)
  }

  private fun rollbackLocalNotificationState(
    gatt: BluetoothGatt,
    characteristic: BluetoothGattCharacteristic,
    previousLocalState: Boolean
  ) {
    try {
      gatt.setCharacteristicNotification(characteristic, previousLocalState)
    } catch (_: SecurityException) {
    }
  }

  private fun cacheCharacteristics(context: ConnectionContext, service: BluetoothGattService) {
    service.characteristics.forEach { context.characteristics[it.uuid] = it }
  }

  private fun closeConnection(deviceId: String, reason: String, rejectConnect: Boolean) {
    val context = connections.remove(deviceId) ?: return
    if (context.isClosed) return
    context.isClosed = true
    context.connectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    context.connectTimeoutRunnable = null
    val activeOperation = context.activeOperation
    clearActiveOperation(context)
    activeOperation?.promise?.reject("NOT_CONNECTED", "Device disconnected.", null)
    if (rejectConnect) {
      context.pendingConnectPromise?.reject("NOT_CONNECTED", "Device disconnected.", null)
    } else {
      context.pendingConnectPromise?.resolve(false)
    }
    context.pendingConnectPromise = null
    context.queue.forEach { it.promise.reject("NOT_CONNECTED", "Device disconnected.", null) }
    context.queue.clear()
    try {
      context.bluetoothGatt?.disconnect()
      context.bluetoothGatt?.close()
    } catch (_: SecurityException) {
    }
    sendConnectionState(deviceId, "disconnected", reason)
  }

  private fun stopScanSafely() {
    if (!isScanning) return
    try {
      scanner?.stopScan(scanCallback)
    } catch (_: SecurityException) {
    }
    isScanning = false
  }

  private fun bluetoothAdapter(): BluetoothAdapter? {
    val context = appContext.reactContext ?: return null
    val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager?.adapter
  }

  private fun requiredPermissions(): List<String> {
    return PansBleApiCodec.requiredPermissionsForSdk(Build.VERSION.SDK_INT)
  }

  private fun hasRequiredPermissions(): Boolean {
    val context = appContext.reactContext ?: return false
    return requiredPermissions().all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
  }

  private fun permissionStatusMap(): Map<String, Any?> {
    val adapter = bluetoothAdapter()
    if (adapter == null) return mapOf("bluetooth" to "unavailable", "location" to "unavailable", "canAskAgain" to false)
    val context = appContext.reactContext ?: return mapOf("bluetooth" to "unavailable", "canAskAgain" to false)
    val activity = appContext.currentActivity
    val denied = requiredPermissions().filter { context.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
    val bluetoothGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
        context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
    } else true
    val locationGranted = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    } else true
    val canAskAgain = denied.isNotEmpty() &&
      (!hasRequestedPermissions || denied.any { permission ->
        activity?.shouldShowRequestPermissionRationale(permission) == true
      })
    return mapOf(
      "bluetooth" to if (bluetoothGranted) "granted" else "denied",
      "location" to if (locationGranted) "granted" else "denied",
      "canAskAgain" to canAskAgain
    )
  }

  private fun sendConnectionState(deviceId: String, state: String, reason: String?) {
    sendEvent("onConnectionStateChanged", mapOf(
      "deviceId" to deviceId,
      "macAddress" to deviceId,
      "state" to state,
      "reason" to reason
    ))
  }

  private fun emitError(code: String, message: String) {
    sendEvent("onError", mapOf("code" to code, "message" to message))
  }

  private fun normalizeDeviceId(deviceId: String): String {
    return PansBleApiCodec.normalizeDeviceId(deviceId)
  }

  private fun parseUuid(uuid: String): UUID {
    return PansBleApiCodec.parseUuid(uuid)
  }

  private fun validatePayload(payload: List<Int>): ByteArray {
    return PansBleApiCodec.validatePayload(payload)
  }

  private fun normalizeWriteType(writeType: String?): Int {
    return PansBleApiCodec.normalizeWriteType(writeType)
  }

  private fun allocateOperationId(): Long = nextOperationId++

  private fun BluetoothAdapter.getRemoteDeviceOrNull(address: String): BluetoothDevice? {
    return try { getRemoteDevice(address) } catch (_: IllegalArgumentException) { null }
  }

  private class ConnectionContext(val deviceId: String) {
    var bluetoothGatt: BluetoothGatt? = null
    var state: String = "connecting"
    val characteristics = mutableMapOf<UUID, BluetoothGattCharacteristic>()
    val notificationStates = mutableMapOf<UUID, Boolean>()
    var pendingConnectPromise: Promise? = null
    var connectTimeoutRunnable: Runnable? = null
    val queue: ArrayDeque<GattOperation> = ArrayDeque()
    var activeOperation: GattOperation? = null
    var activeOperationTimeoutRunnable: Runnable? = null
    var activeNotifyPreviousLocalState: Boolean? = null
    var isClosed = false
  }

  private sealed class GattOperation(val id: Long, val promise: Promise) {
    class Read(id: Long, val uuid: UUID, promise: Promise) : GattOperation(id, promise)
    class Write(id: Long, val uuid: UUID, val payload: ByteArray, val writeType: Int, promise: Promise) : GattOperation(id, promise)
    class Notify(id: Long, val uuid: UUID, val enabled: Boolean, promise: Promise) : GattOperation(id, promise)
    class Mtu(id: Long, val mtu: Int, promise: Promise) : GattOperation(id, promise)
  }

  private sealed class StartResult {
    object Started : StartResult()
    class Failed(val code: String, val message: String) : StartResult()
  }
}
