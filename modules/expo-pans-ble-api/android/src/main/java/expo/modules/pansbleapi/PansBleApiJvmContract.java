package expo.modules.pansbleapi;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Deterministic Android contract logic that intentionally avoids Android framework
 * classes so CI can test it with only a JDK.
 */
public final class PansBleApiJvmContract {
  public static final String PANS_SERVICE_UUID_STRING = "680c21d9-c946-4c1f-9c11-baa1c21329e7";
  public static final String GAP_SERVICE_UUID_STRING = "00001800-0000-1000-8000-00805f9b34fb";
  public static final String CCCD_UUID_STRING = "00002902-0000-1000-8000-00805f9b34fb";

  public static final String OPERATION_MODE_UUID_STRING = "3f0afd88-7770-46b0-b5e7-9fc099598964";
  public static final String NETWORK_ID_UUID_STRING = "80f9d8bc-3bff-45bb-a181-2d6a37991208";
  public static final String LOCATION_DATA_MODE_UUID_STRING = "a02b947e-df97-4516-996a-1882521e0ead";
  public static final String LOCATION_DATA_UUID_STRING = "003bbdf2-c634-4b3d-ab56-7ec889b89a37";
  public static final String DEVICE_INFO_UUID_STRING = "1e63b1eb-d4ed-444e-af54-c1e965192501";

  public static final UUID PANS_SERVICE_UUID = UUID.fromString(PANS_SERVICE_UUID_STRING);
  public static final UUID GAP_SERVICE_UUID = UUID.fromString(GAP_SERVICE_UUID_STRING);
  public static final UUID CCCD_UUID = UUID.fromString(CCCD_UUID_STRING);
  public static final UUID OPERATION_MODE_UUID = UUID.fromString(OPERATION_MODE_UUID_STRING);
  public static final UUID NETWORK_ID_UUID = UUID.fromString(NETWORK_ID_UUID_STRING);
  public static final UUID LOCATION_DATA_MODE_UUID = UUID.fromString(LOCATION_DATA_MODE_UUID_STRING);
  public static final UUID LOCATION_DATA_UUID = UUID.fromString(LOCATION_DATA_UUID_STRING);
  public static final UUID DEVICE_INFO_UUID = UUID.fromString(DEVICE_INFO_UUID_STRING);

  public static final Set<UUID> REQUIRED_COMMON_CHARACTERISTIC_UUIDS = Collections.unmodifiableSet(
    new LinkedHashSet<>(Arrays.asList(
      OPERATION_MODE_UUID,
      NETWORK_ID_UUID,
      LOCATION_DATA_MODE_UUID,
      LOCATION_DATA_UUID,
      DEVICE_INFO_UUID
    ))
  );

  public static final Map<String, Object> ANDROID_CAPABILITIES = androidCapabilities();

  private PansBleApiJvmContract() {}

  public static byte[] validatePayload(List<Integer> payload) {
    byte[] bytes = new byte[payload.size()];
    for (int index = 0; index < payload.size(); index += 1) {
      int value = payload.get(index);
      if (value < 0 || value > 255) {
        throw new IllegalArgumentException("Payload must contain byte values in range 0..255.");
      }
      bytes[index] = (byte) value;
    }

    return bytes;
  }

  public static String normalizeUuidString(String uuid) {
    String trimmed = uuid.trim();
    if (trimmed.isEmpty()) {
      throw new IllegalArgumentException("UUID string must be non-empty.");
    }

    try {
      return UUID.fromString(trimmed).toString().toLowerCase(Locale.US);
    } catch (IllegalArgumentException error) {
      throw new IllegalArgumentException("Invalid canonical 128-bit UUID: " + uuid, error);
    }
  }

  public static UUID parseUuid(String uuid) {
    return UUID.fromString(normalizeUuidString(uuid));
  }

  public static String normalizeDeviceId(String deviceId) {
    String trimmed = deviceId.trim();
    if (trimmed.isEmpty()) {
      throw new IllegalArgumentException("deviceId must be non-empty.");
    }

    // Preserve the current Android module contract: normalize casing here and let
    // BluetoothAdapter validate whether the string is a real MAC address when a
    // connection is attempted.
    return trimmed.toUpperCase(Locale.US);
  }

  public static byte[] validPansServiceData(byte[] serviceData) {
    if (serviceData == null || serviceData.length < 2) {
      return null;
    }

    return serviceData;
  }

  public static byte[] extractPansServiceData(Map<UUID, byte[]> serviceDataByUuid) {
    return validPansServiceData(serviceDataByUuid.get(PANS_SERVICE_UUID));
  }

  public static Map<String, Object> decodePresence(byte[] bytes) {
    if (bytes.length < 2) {
      return null;
    }

    int op = bytes[0] & 0xff;
    int uwbBits = op & 0x03;
    Map<String, Object> presence = new LinkedHashMap<>();
    presence.put("raw", unsignedBytes(bytes));
    presence.put("rawOperationModeByte", op);
    presence.put("rawUwbModeBits", uwbBits);
    presence.put("role", (op & 0x80) != 0 ? "anchor" : "tag");
    presence.put("errorIndicated", (op & 0x10) != 0);
    presence.put("initiator", (op & 0x08) != 0);
    presence.put("bridge", (op & 0x04) != 0);
    presence.put("changeCounter", bytes[1] & 0xff);

    switch (uwbBits) {
      case 0:
        presence.put("uwbMode", "off");
        break;
      case 1:
        presence.put("uwbMode", "passive");
        break;
      case 2:
        presence.put("uwbMode", "active");
        break;
      default:
        break;
    }

    return presence;
  }

  public static List<UUID> missingRequiredCharacteristics(Collection<UUID> characteristicUuids) {
    Set<UUID> discovered = new LinkedHashSet<>(characteristicUuids);
    List<UUID> missing = new ArrayList<>();
    for (UUID requiredUuid : REQUIRED_COMMON_CHARACTERISTIC_UUIDS) {
      if (!discovered.contains(requiredUuid)) {
        missing.add(requiredUuid);
      }
    }
    missing.sort(Comparator.comparing(UUID::toString));
    return missing;
  }

  public static List<String> requiredPermissionsForSdk(int sdkInt) {
    if (sdkInt >= 31) {
      return Arrays.asList("android.permission.BLUETOOTH_SCAN", "android.permission.BLUETOOTH_CONNECT");
    }

    return Collections.singletonList("android.permission.ACCESS_FINE_LOCATION");
  }

  private static Map<String, Object> androidCapabilities() {
    Map<String, Object> capabilities = new LinkedHashMap<>();
    capabilities.put("transport", "ble");
    capabilities.put("supportsScanning", true);
    capabilities.put("supportsConnection", true);
    capabilities.put("supportsNotifications", true);
    capabilities.put("supportsMtuRequest", true);
    capabilities.put("supportsMaximumWriteValueLength", false);
    return Collections.unmodifiableMap(capabilities);
  }

  private static List<Integer> unsignedBytes(byte[] bytes) {
    List<Integer> values = new ArrayList<>(bytes.length);
    for (byte value : bytes) {
      values.add(value & 0xff);
    }
    return values;
  }
}
