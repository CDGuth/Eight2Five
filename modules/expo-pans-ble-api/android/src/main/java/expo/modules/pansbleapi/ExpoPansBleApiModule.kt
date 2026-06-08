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
import android.bluetooth.le.ScanFilter
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
import java.util.UUID
import java.util.ArrayDeque

class ExpoPansBleApiModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val pansServiceUuid: UUID = UUID.fromString("680c21d9-c946-4c1f-9c11-baa1c21329e7")
  private val gapServiceUuid: UUID = UUID.fromString("00001800-0000-1000-8000-00805f9b34fb")
  private val cccdUuid: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

  private val discoveredDevices = mutableMapOf<String, BluetoothDevice>()
  private val discoveredMetadata = mutableMapOf<String, Map<String, Any?>>()
  private val connections = mutableMapOf<String, ConnectionContext>()
  private var scanner: BluetoothLeScanner? = null
  private var isScanning = false

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      handleScanResult(result)
    }

    override fun onBatchScanResults(results: MutableList<ScanResult>) {
      results.forEach { handleScanResult(it) }
    }

    override fun onScanFailed(errorCode: Int) {
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
      connections.values.toList().forEach { closeConnection(it.deviceId, "module destroyed") }
      connections.clear()
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

        scanner = adapter.bluetoothLeScanner
        val scan = scanner
        if (scan == null) {
          promise.reject("BLUETOOTH_UNAVAILABLE", "Bluetooth LE scanner is unavailable.", null)
          return@AsyncFunction
        }

        val filters = listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(pansServiceUuid)).build())
        val settings = ScanSettings.Builder()
          .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
          .build()
        scan.startScan(filters, settings, scanCallback)
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
      mapOf(
        "transport" to "ble",
        "supportsScanning" to true,
        "supportsConnection" to true,
        "supportsNotifications" to true,
        "supportsMtuRequest" to true,
        "supportsMaximumWriteValueLength" to false
      )
    }

    Function("getPermissionStatus") {
      permissionStatusMap()
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(permissionStatusMap())
        return@AsyncFunction
      }
      val missing = requiredPermissions().filter {
        activity.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
      }.toTypedArray()
      if (missing.isNotEmpty()) activity.requestPermissions(missing, 5025)
      mainHandler.postDelayed({ promise.resolve(permissionStatusMap()) }, 350)
    }

    AsyncFunction("connect") { deviceId: String, timeoutMs: Int?, promise: Promise ->
      try {
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
          closeConnection(normalized, "reconnecting")
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
          val pending = connection.pendingConnectPromise
          connection.pendingConnectPromise = null
          pending?.reject("TIMEOUT", "Timed out connecting to $deviceId.", null)
          closeConnection(normalized, "timeout")
        }
        mainHandler.postDelayed(connection.connectTimeoutRunnable!!, (timeoutMs ?: 15000).toLong())

        connection.bluetoothGatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        } else {
          device.connectGatt(context, false, gattCallback)
        }
      } catch (error: IllegalArgumentException) {
        promise.reject("INVALID_ARGUMENT", error.message ?: "Invalid device ID.", error)
      } catch (error: SecurityException) {
        promise.reject("PERMISSION_DENIED", error.message ?: "Bluetooth permission denied.", error)
      } catch (error: Throwable) {
        promise.reject("OPERATION_FAILED", error.message ?: "Unable to connect.", error)
      }
    }

    AsyncFunction("disconnect") { deviceId: String, promise: Promise ->
      closeConnection(normalizeDeviceId(deviceId), "local disconnect")
      promise.resolve(true)
    }

    AsyncFunction("readCharacteristic") { deviceId: String, characteristicUuid: String, promise: Promise ->
      enqueue(normalizeDeviceId(deviceId), GattOperation.Read(UUID.fromString(characteristicUuid), promise))
    }

    AsyncFunction("writeCharacteristic") { deviceId: String, characteristicUuid: String, payload: List<Int>, writeType: String?, promise: Promise ->
      val bytes = payload.map { it.toByte() }.toByteArray()
      val type = if (writeType == "withoutResponse") {
        BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
      } else {
        BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      }
      enqueue(normalizeDeviceId(deviceId), GattOperation.Write(UUID.fromString(characteristicUuid), bytes, type, promise))
    }

    AsyncFunction("setCharacteristicNotifications") { deviceId: String, characteristicUuid: String, enabled: Boolean, promise: Promise ->
      enqueue(normalizeDeviceId(deviceId), GattOperation.Notify(UUID.fromString(characteristicUuid), enabled, promise))
    }

    AsyncFunction("requestMtu") { deviceId: String, mtu: Int, promise: Promise ->
      enqueue(normalizeDeviceId(deviceId), GattOperation.Mtu(mtu, promise))
    }
  }

  private val gattCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      val deviceId = normalizeDeviceId(gatt.device.address)
      val context = connections[deviceId] ?: return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        context.pendingConnectPromise?.reject("GATT_ERROR", "GATT connection failed with status $status.", null)
        context.pendingConnectPromise = null
        closeConnection(deviceId, "gatt status $status")
        return
      }
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        context.state = "discovering"
        try {
          gatt.discoverServices()
        } catch (error: SecurityException) {
          context.pendingConnectPromise?.reject("PERMISSION_DENIED", error.message ?: "Bluetooth permission denied.", error)
          context.pendingConnectPromise = null
        }
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        closeConnection(deviceId, "remote disconnect")
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val deviceId = normalizeDeviceId(gatt.device.address)
      val context = connections[deviceId] ?: return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        context.pendingConnectPromise?.reject("GATT_ERROR", "Service discovery failed with status $status.", null)
        context.pendingConnectPromise = null
        closeConnection(deviceId, "service discovery failed")
        return
      }

      val pansService = gatt.getService(pansServiceUuid)
      if (pansService == null) {
        context.pendingConnectPromise?.reject("SERVICE_NOT_FOUND", "PANS network-node service was not discovered.", null)
        context.pendingConnectPromise = null
        closeConnection(deviceId, "service missing")
        return
      }

      cacheCharacteristics(context, pansService)
      gatt.getService(gapServiceUuid)?.let { cacheCharacteristics(context, it) }
      context.state = "connected"
      mainHandler.removeCallbacks(context.connectTimeoutRunnable ?: Runnable {})
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
      val context = connections[normalizeDeviceId(gatt.device.address)] ?: return
      finishOperation(context, status == BluetoothGatt.GATT_SUCCESS) { it.resolve(true) }
    }

    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      val context = connections[normalizeDeviceId(gatt.device.address)] ?: return
      finishOperation(context, status == BluetoothGatt.GATT_SUCCESS) { it.resolve(true) }
    }

    @Deprecated("Deprecated in Android 13")
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      emitCharacteristicChanged(gatt, characteristic, characteristic.value ?: ByteArray(0))
    }

    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
      emitCharacteristicChanged(gatt, characteristic, value)
    }

    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      val context = connections[normalizeDeviceId(gatt.device.address)] ?: return
      finishOperation(context, status == BluetoothGatt.GATT_SUCCESS) { it.resolve(mtu) }
    }
  }

  private fun onCharacteristicReadValue(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
    val context = connections[normalizeDeviceId(gatt.device.address)] ?: return
    finishOperation(context, status == BluetoothGatt.GATT_SUCCESS) { it.resolve(value.map { byte -> byte.toInt() and 0xff }) }
  }

  private fun emitCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
    val deviceId = normalizeDeviceId(gatt.device.address)
    sendEvent("onCharacteristicNotification", mapOf(
      "deviceId" to deviceId,
      "macAddress" to deviceId,
      "characteristicUuid" to characteristic.uuid.toString().lowercase(),
      "payload" to value.map { it.toInt() and 0xff }
    ))
  }

  private fun handleScanResult(result: ScanResult) {
    val device = result.device ?: return
    val deviceId = normalizeDeviceId(device.address)
    val record = result.scanRecord
    val serviceData = record?.getServiceData(ParcelUuid(pansServiceUuid))
    val presence = serviceData?.takeIf { it.size >= 2 }?.let { decodePresence(it) }
    val metadata = mapOf(
      "deviceId" to deviceId,
      "macAddress" to device.address,
      "mac" to device.address,
      "name" to (record?.deviceName ?: device.name),
      "rssi" to result.rssi,
      "lastSeenMs" to System.currentTimeMillis().toDouble(),
      "presence" to presence
    )
    discoveredDevices[deviceId] = device
    discoveredMetadata[deviceId] = metadata
    sendEvent("onDeviceDiscovered", mapOf("devices" to discoveredMetadata.values.toList()))
  }

  private fun decodePresence(bytes: ByteArray): Map<String, Any> {
    val op = bytes[0].toInt() and 0xff
    val change = bytes[1].toInt() and 0xff
    return mapOf(
      "rawOperationModeByte" to op,
      "role" to if ((op and 0x80) != 0) "anchor" else "tag",
      "errorIndicated" to ((op and 0x10) != 0),
      "initiator" to ((op and 0x08) != 0),
      "bridge" to ((op and 0x04) != 0),
      "uwbMode" to when (op and 0x03) { 1 -> "passive"; 2 -> "active"; else -> "off" },
      "changeCounter" to change
    )
  }

  private fun enqueue(deviceId: String, operation: GattOperation) {
    val context = connections[deviceId]
    if (context == null || context.state != "connected") {
      operation.promise.reject("NOT_CONNECTED", "Device $deviceId is not connected.", null)
      return
    }
    context.queue.add(operation)
    if (context.activeOperation == null) startNextOperation(context)
  }

  private fun startNextOperation(context: ConnectionContext) {
    val operation = context.queue.poll() ?: return
    val gatt = context.bluetoothGatt
    if (gatt == null) {
      operation.promise.reject("NOT_CONNECTED", "GATT client is not available.", null)
      return
    }
    context.activeOperation = operation
    mainHandler.postDelayed({
      if (context.activeOperation === operation) {
        context.activeOperation = null
        operation.promise.reject("TIMEOUT", "GATT operation timed out.", null)
        startNextOperation(context)
      }
    }, 10000)

    try {
      val started = when (operation) {
        is GattOperation.Read -> startRead(context, gatt, operation)
        is GattOperation.Write -> startWrite(context, gatt, operation)
        is GattOperation.Notify -> startNotify(context, gatt, operation)
        is GattOperation.Mtu -> gatt.requestMtu(operation.mtu)
      }
      if (!started) {
        context.activeOperation = null
        operation.promise.reject("OPERATION_FAILED", "Failed to start GATT operation.", null)
        startNextOperation(context)
      }
    } catch (error: SecurityException) {
      context.activeOperation = null
      operation.promise.reject("PERMISSION_DENIED", error.message ?: "Bluetooth permission denied.", error)
      startNextOperation(context)
    }
  }

  private fun startRead(context: ConnectionContext, gatt: BluetoothGatt, operation: GattOperation.Read): Boolean {
    val characteristic = context.characteristics[operation.uuid]
    if (characteristic == null) {
      operation.promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic ${operation.uuid} was not discovered.", null)
      return false
    }
    return gatt.readCharacteristic(characteristic)
  }

  private fun startWrite(context: ConnectionContext, gatt: BluetoothGatt, operation: GattOperation.Write): Boolean {
    val characteristic = context.characteristics[operation.uuid]
    if (characteristic == null) {
      operation.promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic ${operation.uuid} was not discovered.", null)
      return false
    }
    characteristic.writeType = operation.writeType
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      gatt.writeCharacteristic(characteristic, operation.payload, operation.writeType) == BluetoothGatt.GATT_SUCCESS
    } else {
      @Suppress("DEPRECATION")
      characteristic.value = operation.payload
      @Suppress("DEPRECATION")
      gatt.writeCharacteristic(characteristic)
    }
  }

  private fun startNotify(context: ConnectionContext, gatt: BluetoothGatt, operation: GattOperation.Notify): Boolean {
    val characteristic = context.characteristics[operation.uuid]
    if (characteristic == null) {
      operation.promise.reject("CHARACTERISTIC_NOT_FOUND", "Characteristic ${operation.uuid} was not discovered.", null)
      return false
    }
    if (!gatt.setCharacteristicNotification(characteristic, operation.enabled)) return false
    val descriptor = characteristic.getDescriptor(cccdUuid)
    if (descriptor == null) {
      operation.promise.reject("CHARACTERISTIC_NOT_FOUND", "CCCD descriptor was not found for ${operation.uuid}.", null)
      return false
    }
    val enabledValue = if (!operation.enabled) {
      BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
    } else if ((characteristic.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) {
      BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
    } else {
      BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
    }
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      gatt.writeDescriptor(descriptor, enabledValue) == BluetoothGatt.GATT_SUCCESS
    } else {
      @Suppress("DEPRECATION")
      descriptor.value = enabledValue
      @Suppress("DEPRECATION")
      gatt.writeDescriptor(descriptor)
    }
  }

  private fun finishOperation(context: ConnectionContext, success: Boolean, resolve: (Promise) -> Unit) {
    val operation = context.activeOperation ?: return
    context.activeOperation = null
    if (success) resolve(operation.promise) else operation.promise.reject("GATT_ERROR", "GATT operation failed.", null)
    startNextOperation(context)
  }

  private fun cacheCharacteristics(context: ConnectionContext, service: BluetoothGattService) {
    service.characteristics.forEach { context.characteristics[it.uuid] = it }
  }

  private fun closeConnection(deviceId: String, reason: String) {
    val context = connections.remove(deviceId) ?: return
    context.connectTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    context.pendingConnectPromise?.resolve(false)
    context.pendingConnectPromise = null
    context.activeOperation?.promise?.reject("NOT_CONNECTED", "Device disconnected.", null)
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
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    } else {
      listOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }
  }

  private fun hasRequiredPermissions(): Boolean {
    val context = appContext.reactContext ?: return false
    return requiredPermissions().all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
  }

  private fun permissionStatusMap(): Map<String, Any?> {
    val adapter = bluetoothAdapter()
    if (adapter == null) return mapOf("bluetooth" to "unavailable", "location" to "unavailable", "canAskAgain" to false)
    val context = appContext.reactContext ?: return mapOf("bluetooth" to "unavailable", "canAskAgain" to false)
    val bluetoothGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
        context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
    } else true
    val locationGranted = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    } else true
    return mapOf(
      "bluetooth" to if (bluetoothGranted) "granted" else "denied",
      "location" to if (locationGranted) "granted" else "denied",
      "canAskAgain" to true
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

  private fun normalizeDeviceId(deviceId: String): String = deviceId.uppercase()

  private fun BluetoothAdapter.getRemoteDeviceOrNull(address: String): BluetoothDevice? {
    return try { getRemoteDevice(address) } catch (_: IllegalArgumentException) { null }
  }

  private class ConnectionContext(val deviceId: String) {
    var bluetoothGatt: BluetoothGatt? = null
    var state: String = "connecting"
    val characteristics = mutableMapOf<UUID, BluetoothGattCharacteristic>()
    var pendingConnectPromise: Promise? = null
    var connectTimeoutRunnable: Runnable? = null
    val queue: ArrayDeque<GattOperation> = ArrayDeque()
    var activeOperation: GattOperation? = null
  }

  private sealed class GattOperation(val promise: Promise) {
    class Read(val uuid: UUID, promise: Promise) : GattOperation(promise)
    class Write(val uuid: UUID, val payload: ByteArray, val writeType: Int, promise: Promise) : GattOperation(promise)
    class Notify(val uuid: UUID, val enabled: Boolean, promise: Promise) : GattOperation(promise)
    class Mtu(val mtu: Int, promise: Promise) : GattOperation(promise)
  }
}
