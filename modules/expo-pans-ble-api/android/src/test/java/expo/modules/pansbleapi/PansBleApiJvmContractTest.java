package expo.modules.pansbleapi;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class PansBleApiJvmContractTest {
  private PansBleApiJvmContractTest() {}

  public static void main(String[] args) {
    constantsMatchDocumentedPansGattUuids();
    androidCapabilitiesDescribeBluetoothGattSupport();
    payloadValidationAcceptsBytesAndPreservesOrder();
    payloadValidationRejectsOutOfRangeValues();
    uuidNormalizationAcceptsCanonicalValuesAndRejectsMalformedValues();
    deviceIdNormalizationPreservesCurrentAndroidBehavior();
    presenceServiceDataExtractionAndDecodingAreDefensive();
    presenceDecoderMatchesCurrentNativeEventContract();
    connectionValidationDoesNotRequireBluetoothHardware();
    permissionSelectionDependsOnSdkLevel();
    System.out.println("PansBleApiJvmContractTest passed");
  }

  private static void constantsMatchDocumentedPansGattUuids() {
    assertEquals(UUID.fromString("680c21d9-c946-4c1f-9c11-baa1c21329e7"), PansBleApiJvmContract.PANS_SERVICE_UUID);
    assertEquals(UUID.fromString("00001800-0000-1000-8000-00805f9b34fb"), PansBleApiJvmContract.GAP_SERVICE_UUID);
    assertEquals(UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"), PansBleApiJvmContract.CCCD_UUID);
    assertEquals(5, PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS.size());
    assertTrue(PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS.contains(PansBleApiJvmContract.OPERATION_MODE_UUID));
    assertTrue(PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS.contains(PansBleApiJvmContract.NETWORK_ID_UUID));
    assertTrue(PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS.contains(PansBleApiJvmContract.LOCATION_DATA_MODE_UUID));
    assertTrue(PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS.contains(PansBleApiJvmContract.LOCATION_DATA_UUID));
    assertTrue(PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS.contains(PansBleApiJvmContract.DEVICE_INFO_UUID));
  }

  private static void androidCapabilitiesDescribeBluetoothGattSupport() {
    Map<String, Object> capabilities = PansBleApiJvmContract.ANDROID_CAPABILITIES;

    assertEquals("ble", capabilities.get("transport"));
    assertEquals(true, capabilities.get("supportsScanning"));
    assertEquals(true, capabilities.get("supportsConnection"));
    assertEquals(true, capabilities.get("supportsNotifications"));
    assertEquals(true, capabilities.get("supportsMtuRequest"));
    assertEquals(false, capabilities.get("supportsMaximumWriteValueLength"));
  }

  private static void payloadValidationAcceptsBytesAndPreservesOrder() {
    assertUnsignedBytes(Collections.emptyList(), PansBleApiJvmContract.validatePayload(Collections.emptyList()));
    assertUnsignedBytes(
      Arrays.asList(0, 1, 127, 128, 255),
      PansBleApiJvmContract.validatePayload(Arrays.asList(0, 1, 127, 128, 255))
    );
  }

  private static void payloadValidationRejectsOutOfRangeValues() {
    assertThrowsIllegalArgument(() -> PansBleApiJvmContract.validatePayload(Collections.singletonList(-1)));
    assertThrowsIllegalArgument(() -> PansBleApiJvmContract.validatePayload(Collections.singletonList(256)));
  }

  private static void uuidNormalizationAcceptsCanonicalValuesAndRejectsMalformedValues() {
    String canonical = "680c21d9-c946-4c1f-9c11-baa1c21329e7";

    assertEquals(canonical, PansBleApiJvmContract.normalizeUuidString(canonical));
    assertEquals(canonical, PansBleApiJvmContract.normalizeUuidString(canonical.toUpperCase()));
    assertEquals(UUID.fromString(canonical), PansBleApiJvmContract.parseUuid(canonical));
    assertThrowsIllegalArgument(() -> PansBleApiJvmContract.normalizeUuidString(""));
    assertThrowsIllegalArgument(() -> PansBleApiJvmContract.normalizeUuidString(" \n\t "));
    assertThrowsIllegalArgument(() -> PansBleApiJvmContract.normalizeUuidString("not-a-uuid"));
    assertThrowsIllegalArgument(() -> PansBleApiJvmContract.normalizeUuidString("2a00"));
  }

  private static void deviceIdNormalizationPreservesCurrentAndroidBehavior() {
    assertEquals("AA:BB:CC:DD:EE:FF", PansBleApiJvmContract.normalizeDeviceId(" aa:bb:cc:dd:ee:ff "));
    assertThrowsIllegalArgument(() -> PansBleApiJvmContract.normalizeDeviceId("  "));

    // Best-judgment decision from the existing implementation: malformed-looking
    // IDs are uppercased here and rejected later by BluetoothAdapter if needed.
    assertEquals("NOT-A-MAC", PansBleApiJvmContract.normalizeDeviceId("not-a-mac"));
  }

  private static void presenceServiceDataExtractionAndDecodingAreDefensive() {
    assertEquals(null, PansBleApiJvmContract.validPansServiceData(new byte[] {}));
    assertEquals(null, PansBleApiJvmContract.validPansServiceData(new byte[] {(byte) 0x9a}));
    assertEquals(null, PansBleApiJvmContract.decodePresence(new byte[] {}));
    assertEquals(null, PansBleApiJvmContract.decodePresence(new byte[] {(byte) 0x9a}));

    Map<UUID, byte[]> serviceData = new LinkedHashMap<>();
    serviceData.put(PansBleApiJvmContract.PANS_SERVICE_UUID, new byte[] {(byte) 0x9a, 0x07, (byte) 0xff});
    assertUnsignedBytes(Arrays.asList(0x9a, 0x07, 0xff), PansBleApiJvmContract.extractPansServiceData(serviceData));
  }

  private static void presenceDecoderMatchesCurrentNativeEventContract() {
    Map<String, Object> tag = requireMap(PansBleApiJvmContract.decodePresence(new byte[] {0x00, 0x00}));
    assertEquals(Arrays.asList(0x00, 0x00), tag.get("raw"));
    assertEquals(0, tag.get("rawOperationModeByte"));
    assertEquals(0, tag.get("rawUwbModeBits"));
    assertEquals("tag", tag.get("role"));
    assertEquals("off", tag.get("uwbMode"));
    assertEquals(0, tag.get("changeCounter"));

    Map<String, Object> anchor = requireMap(
      PansBleApiJvmContract.decodePresence(new byte[] {(byte) 0x9a, 0x07, (byte) 0xff})
    );
    assertEquals(Arrays.asList(0x9a, 0x07, 0xff), anchor.get("raw"));
    assertEquals(0x9a, anchor.get("rawOperationModeByte"));
    assertEquals(2, anchor.get("rawUwbModeBits"));
    assertEquals("anchor", anchor.get("role"));
    assertEquals(true, anchor.get("errorIndicated"));
    assertEquals(true, anchor.get("initiator"));
    assertEquals(false, anchor.get("bridge"));
    assertEquals("active", anchor.get("uwbMode"));
    assertEquals(7, anchor.get("changeCounter"));

    Map<String, Object> unknownMode = requireMap(PansBleApiJvmContract.decodePresence(new byte[] {0x03, 0x01}));
    assertEquals(3, unknownMode.get("rawUwbModeBits"));
    assertFalse(unknownMode.containsKey("uwbMode"));
  }

  private static void connectionValidationDoesNotRequireBluetoothHardware() {
    assertEquals(
      PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS.size(),
      PansBleApiJvmContract.missingRequiredCharacteristics(Collections.emptyList()).size()
    );
    assertTrue(
      PansBleApiJvmContract.missingRequiredCharacteristics(PansBleApiJvmContract.REQUIRED_COMMON_CHARACTERISTIC_UUIDS).isEmpty()
    );
  }

  private static void permissionSelectionDependsOnSdkLevel() {
    assertEquals(
      Collections.singletonList("android.permission.ACCESS_FINE_LOCATION"),
      PansBleApiJvmContract.requiredPermissionsForSdk(30)
    );
    assertEquals(
      Arrays.asList("android.permission.BLUETOOTH_SCAN", "android.permission.BLUETOOTH_CONNECT"),
      PansBleApiJvmContract.requiredPermissionsForSdk(31)
    );
  }

  private static Map<String, Object> requireMap(Map<String, Object> value) {
    if (value == null) {
      throw new AssertionError("Expected non-null map");
    }
    return value;
  }

  private static void assertUnsignedBytes(List<Integer> expected, byte[] actual) {
    if (actual == null) {
      throw new AssertionError("Expected byte array, got null");
    }

    for (int index = 0; index < expected.size(); index += 1) {
      int value = actual[index] & 0xff;
      if (value != expected.get(index)) {
        throw new AssertionError("Expected byte " + index + " to be " + expected.get(index) + ", got " + value);
      }
    }
    assertEquals(expected.size(), actual.length);
  }

  private static void assertThrowsIllegalArgument(Runnable block) {
    try {
      block.run();
    } catch (IllegalArgumentException expected) {
      return;
    }
    throw new AssertionError("Expected IllegalArgumentException");
  }

  private static void assertEquals(Object expected, Object actual) {
    if (expected == null ? actual != null : !expected.equals(actual)) {
      throw new AssertionError("Expected " + expected + ", got " + actual);
    }
  }

  private static void assertTrue(boolean value) {
    if (!value) {
      throw new AssertionError("Expected true");
    }
  }

  private static void assertFalse(boolean value) {
    if (value) {
      throw new AssertionError("Expected false");
    }
  }
}
