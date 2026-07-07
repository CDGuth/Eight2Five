package expo.modules.pansbleapi

import android.bluetooth.BluetoothGattCharacteristic
import android.os.Build
import java.util.UUID

internal object PansBleApiCodec {
  fun validatePayload(payload: List<Int>): ByteArray {
    return PansBleApiJvmContract.validatePayload(payload)
  }

  fun normalizeUuidString(uuid: String): String {
    return PansBleApiJvmContract.normalizeUuidString(uuid)
  }

  fun parseUuid(uuid: String): UUID = UUID.fromString(normalizeUuidString(uuid))

  fun normalizeDeviceId(deviceId: String): String {
    return PansBleApiJvmContract.normalizeDeviceId(deviceId)
  }

  fun validPansServiceData(serviceData: ByteArray?): ByteArray? {
    return PansBleApiJvmContract.validPansServiceData(serviceData)
  }

  fun extractPansServiceData(serviceDataByUuid: Map<UUID, ByteArray>): ByteArray? {
    return PansBleApiJvmContract.extractPansServiceData(serviceDataByUuid)
  }

  fun decodePresence(bytes: ByteArray): Map<String, Any>? {
    return PansBleApiJvmContract.decodePresence(bytes)
  }

  fun missingRequiredCharacteristics(characteristicUuids: Collection<UUID>): List<UUID> {
    return PansBleApiJvmContract.missingRequiredCharacteristics(characteristicUuids)
  }

  fun requiredPermissionsForSdk(sdkInt: Int): List<String> {
    return PansBleApiJvmContract.requiredPermissionsForSdk(sdkInt)
  }

  fun normalizeWriteType(writeType: String?): Int {
    return when (writeType ?: "withResponse") {
      "withResponse" -> BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      "withoutResponse" -> BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
      else -> throw IllegalArgumentException("writeType must be withResponse or withoutResponse.")
    }
  }

  // TODO: Add native TLV/location-data decoding once the native module starts
  // parsing location characteristic payloads. The current native bridge preserves
  // raw characteristic bytes for TypeScript codecs to decode.
}
