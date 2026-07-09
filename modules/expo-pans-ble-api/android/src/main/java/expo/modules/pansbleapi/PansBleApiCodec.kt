package expo.modules.pansbleapi

import android.bluetooth.BluetoothGattCharacteristic
import java.util.UUID

internal object PansBleApiCodec {
  fun validatePayload(payload: List<Int>): ByteArray {
    return PansBleApiCore.validatePayload(payload)
  }

  fun normalizeUuidString(uuid: String): String {
    return PansBleApiCore.normalizeUuidString(uuid)
  }

  fun parseUuid(uuid: String): UUID {
    return PansBleApiCore.parseUuid(uuid)
  }

  fun normalizeDeviceId(deviceId: String): String {
    return PansBleApiCore.normalizeDeviceId(deviceId)
  }

  fun validPansServiceData(serviceData: ByteArray?): ByteArray? {
    return PansBleApiCore.validPansServiceData(serviceData)
  }

  fun extractPansServiceData(serviceDataByUuid: Map<UUID, ByteArray>): ByteArray? {
    return PansBleApiCore.extractPansServiceData(serviceDataByUuid)
  }

  fun decodePresence(bytes: ByteArray): Map<String, Any>? {
    return PansBleApiCore.decodePresence(bytes)
  }

  fun missingRequiredCharacteristics(characteristicUuids: Collection<UUID>): List<UUID> {
    return PansBleApiCore.missingRequiredCharacteristics(characteristicUuids)
  }

  fun requiredPermissionsForSdk(sdkInt: Int): List<String> {
    return PansBleApiCore.requiredPermissionsForSdk(sdkInt)
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
