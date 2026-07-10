import Foundation

public enum PansBleApiConstants {
  public static let pansServiceUuid = "680c21d9-c946-4c1f-9c11-baa1c21329e7"
  public static let gapServiceUuid = "00001800-0000-1000-8000-00805f9b34fb"
  public static let cccdUuid = "00002902-0000-1000-8000-00805f9b34fb"

  public enum Characteristics {
    public static let operationMode = "3f0afd88-7770-46b0-b5e7-9fc099598964"
    public static let networkId = "80f9d8bc-3bff-45bb-a181-2d6a37991208"
    public static let locationDataMode = "a02b947e-df97-4516-996a-1882521e0ead"
    public static let locationData = "003bbdf2-c634-4b3d-ab56-7ec889b89a37"
    public static let deviceInfo = "1e63b1eb-d4ed-444e-af54-c1e965192501"
  }

  public static let requiredCommonCharacteristicUuids: Set<String> = [
    Characteristics.operationMode,
    Characteristics.networkId,
    Characteristics.locationDataMode,
    Characteristics.locationData,
    Characteristics.deviceInfo,
  ]

  public static let iosCapabilities: [String: Any] = [
    "transport": "ble",
    "supportsScanning": true,
    "supportsConnection": true,
    "supportsNotifications": true,
    "supportsMtuRequest": false,
    "supportsMaximumWriteValueLength": true,
  ]
}
