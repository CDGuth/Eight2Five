package expo.modules.pansbleapi

import java.util.UUID

internal object PansBleApiConstants {
  val PANS_SERVICE_UUID_STRING: String = PansBleApiJvmContract.PANS_SERVICE_UUID_STRING
  val GAP_SERVICE_UUID_STRING: String = PansBleApiJvmContract.GAP_SERVICE_UUID_STRING
  val CCCD_UUID_STRING: String = PansBleApiJvmContract.CCCD_UUID_STRING

  val OPERATION_MODE_UUID_STRING: String = PansBleApiJvmContract.OPERATION_MODE_UUID_STRING
  val NETWORK_ID_UUID_STRING: String = PansBleApiJvmContract.NETWORK_ID_UUID_STRING
  val LOCATION_DATA_MODE_UUID_STRING: String = PansBleApiJvmContract.LOCATION_DATA_MODE_UUID_STRING
  val LOCATION_DATA_UUID_STRING: String = PansBleApiJvmContract.LOCATION_DATA_UUID_STRING
  val DEVICE_INFO_UUID_STRING: String = PansBleApiJvmContract.DEVICE_INFO_UUID_STRING

  val pansServiceUuid: UUID = PansBleApiJvmContract.PANS_SERVICE_UUID
  val gapServiceUuid: UUID = PansBleApiJvmContract.GAP_SERVICE_UUID
  val cccdUuid: UUID = PansBleApiJvmContract.CCCD_UUID

  val operationModeUuid: UUID = PansBleApiJvmContract.OPERATION_MODE_UUID
  val networkIdUuid: UUID = PansBleApiJvmContract.NETWORK_ID_UUID
  val locationDataModeUuid: UUID = PansBleApiJvmContract.LOCATION_DATA_MODE_UUID
  val locationDataUuid: UUID = PansBleApiJvmContract.LOCATION_DATA_UUID
  val deviceInfoUuid: UUID = PansBleApiJvmContract.DEVICE_INFO_UUID

  val requiredCommonCharacteristicUuids: Set<UUID> = PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS

  val androidCapabilities: Map<String, Any> = PansBleApiJvmContract.ANDROID_CAPABILITIES
}
