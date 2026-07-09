package expo.modules.pansbleapi

import java.util.UUID

internal object PansBleApiConstants {
  val PANS_SERVICE_UUID_STRING: String = PansBleApiCore.PANS_SERVICE_UUID_STRING
  val GAP_SERVICE_UUID_STRING: String = PansBleApiCore.GAP_SERVICE_UUID_STRING
  val CCCD_UUID_STRING: String = PansBleApiCore.CCCD_UUID_STRING

  val OPERATION_MODE_UUID_STRING: String = PansBleApiCore.OPERATION_MODE_UUID_STRING
  val NETWORK_ID_UUID_STRING: String = PansBleApiCore.NETWORK_ID_UUID_STRING
  val LOCATION_DATA_MODE_UUID_STRING: String = PansBleApiCore.LOCATION_DATA_MODE_UUID_STRING
  val LOCATION_DATA_UUID_STRING: String = PansBleApiCore.LOCATION_DATA_UUID_STRING
  val DEVICE_INFO_UUID_STRING: String = PansBleApiCore.DEVICE_INFO_UUID_STRING

  val pansServiceUuid: UUID = PansBleApiCore.pansServiceUuid
  val gapServiceUuid: UUID = PansBleApiCore.gapServiceUuid
  val cccdUuid: UUID = PansBleApiCore.cccdUuid

  val operationModeUuid: UUID = PansBleApiCore.operationModeUuid
  val networkIdUuid: UUID = PansBleApiCore.networkIdUuid
  val locationDataModeUuid: UUID = PansBleApiCore.locationDataModeUuid
  val locationDataUuid: UUID = PansBleApiCore.locationDataUuid
  val deviceInfoUuid: UUID = PansBleApiCore.deviceInfoUuid

  val requiredCommonCharacteristicUuids: Set<UUID> = PansBleApiCore.requiredCommonCharacteristicUuids

  val androidCapabilities: Map<String, Any> = PansBleApiCore.androidCapabilities
}
