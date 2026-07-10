package expo.modules.pansbleapi

import java.util.Locale
import java.util.UUID

/**
 * Android-free PANS BLE contract logic shared by the Expo Android module and
 * fast Kotlin/JVM tests. Keep this file free of Android framework imports so it
 * can run in CI without an Android SDK, emulator, Bluetooth radio, or hardware.
 */
object PansBleApiCore {
  const val PANS_SERVICE_UUID_STRING = "680c21d9-c946-4c1f-9c11-baa1c21329e7"
  const val GAP_SERVICE_UUID_STRING = "00001800-0000-1000-8000-00805f9b34fb"
  const val CCCD_UUID_STRING = "00002902-0000-1000-8000-00805f9b34fb"

  const val OPERATION_MODE_UUID_STRING = "3f0afd88-7770-46b0-b5e7-9fc099598964"
  const val NETWORK_ID_UUID_STRING = "80f9d8bc-3bff-45bb-a181-2d6a37991208"
  const val LOCATION_DATA_MODE_UUID_STRING = "a02b947e-df97-4516-996a-1882521e0ead"
  const val LOCATION_DATA_UUID_STRING = "003bbdf2-c634-4b3d-ab56-7ec889b89a37"
  const val DEVICE_INFO_UUID_STRING = "1e63b1eb-d4ed-444e-af54-c1e965192501"

  val pansServiceUuid: UUID = UUID.fromString(PANS_SERVICE_UUID_STRING)
  val gapServiceUuid: UUID = UUID.fromString(GAP_SERVICE_UUID_STRING)
  val cccdUuid: UUID = UUID.fromString(CCCD_UUID_STRING)

  val operationModeUuid: UUID = UUID.fromString(OPERATION_MODE_UUID_STRING)
  val networkIdUuid: UUID = UUID.fromString(NETWORK_ID_UUID_STRING)
  val locationDataModeUuid: UUID = UUID.fromString(LOCATION_DATA_MODE_UUID_STRING)
  val locationDataUuid: UUID = UUID.fromString(LOCATION_DATA_UUID_STRING)
  val deviceInfoUuid: UUID = UUID.fromString(DEVICE_INFO_UUID_STRING)

  val requiredCommonCharacteristicUuids: Set<UUID> = linkedSetOf(
    operationModeUuid,
    networkIdUuid,
    locationDataModeUuid,
    locationDataUuid,
    deviceInfoUuid,
  )

  val androidCapabilities: Map<String, Any> = linkedMapOf(
    "transport" to "ble",
    "supportsScanning" to true,
    "supportsConnection" to true,
    "supportsNotifications" to true,
    "supportsMtuRequest" to true,
    "supportsMaximumWriteValueLength" to false,
  )

  fun validatePayload(payload: List<Int>): ByteArray {
    return payload.map { value ->
      require(value in 0..255) {
        "Payload must contain byte values in range 0..255."
      }
      value.toByte()
    }.toByteArray()
  }

  fun normalizeUuidString(uuid: String): String {
    val trimmed = uuid.trim()
    require(trimmed.isNotEmpty()) { "UUID string must be non-empty." }

    return try {
      UUID.fromString(trimmed).toString().lowercase(Locale.US)
    } catch (error: IllegalArgumentException) {
      throw IllegalArgumentException("Invalid canonical 128-bit UUID: $uuid", error)
    }
  }

  fun parseUuid(uuid: String): UUID = UUID.fromString(normalizeUuidString(uuid))

  fun normalizeDeviceId(deviceId: String): String {
    val trimmed = deviceId.trim()
    require(trimmed.isNotEmpty()) { "deviceId must be non-empty." }

    // Preserve the current Android module contract: normalize casing here and let
    // BluetoothAdapter validate whether the string is a real MAC address when a
    // connection is attempted.
    return trimmed.uppercase(Locale.US)
  }

  fun validPansServiceData(serviceData: ByteArray?): ByteArray? {
    return serviceData?.takeIf { it.size >= 2 }
  }

  fun extractPansServiceData(serviceDataByUuid: Map<UUID, ByteArray>): ByteArray? {
    return validPansServiceData(serviceDataByUuid[pansServiceUuid])
  }

  fun decodePresence(bytes: ByteArray): Map<String, Any>? {
    if (bytes.size < 2) return null

    val op = bytes[0].toInt() and 0xff
    val uwbBits = op and 0x03
    val presence = linkedMapOf<String, Any>(
      "raw" to bytes.map { it.toInt() and 0xff },
      "rawOperationModeByte" to op,
      "rawUwbModeBits" to uwbBits,
      "role" to if ((op and 0x80) != 0) "anchor" else "tag",
      "errorIndicated" to ((op and 0x10) != 0),
      "initiator" to ((op and 0x08) != 0),
      "bridge" to ((op and 0x04) != 0),
      "changeCounter" to (bytes[1].toInt() and 0xff),
    )

    when (uwbBits) {
      0 -> presence["uwbMode"] = "off"
      1 -> presence["uwbMode"] = "passive"
      2 -> presence["uwbMode"] = "active"
    }

    return presence
  }

  fun missingRequiredCharacteristics(characteristicUuids: Collection<UUID>): List<UUID> {
    val discovered = characteristicUuids.toSet()
    return requiredCommonCharacteristicUuids
      .filter { it !in discovered }
      .sortedBy { it.toString() }
  }

  fun requiredPermissionsForSdk(sdkInt: Int): List<String> {
    return if (sdkInt >= 31) {
      listOf(
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
      )
    } else {
      listOf("android.permission.ACCESS_FINE_LOCATION")
    }
  }
}
