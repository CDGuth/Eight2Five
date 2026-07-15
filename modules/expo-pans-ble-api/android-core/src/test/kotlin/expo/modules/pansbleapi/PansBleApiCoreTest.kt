package expo.modules.pansbleapi

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PansBleApiCoreTest {
  @Test
  fun constantsMatchDocumentedPansGattUuids() {
    assertEquals("680c21d9-c946-4c1f-9c11-baa1c21329e7", PansBleApiCore.PANS_SERVICE_UUID_STRING)
    assertEquals(UUID.fromString("680c21d9-c946-4c1f-9c11-baa1c21329e7"), PansBleApiCore.pansServiceUuid)
    assertEquals("00001800-0000-1000-8000-00805f9b34fb", PansBleApiCore.GAP_SERVICE_UUID_STRING)
    assertEquals(UUID.fromString("00001800-0000-1000-8000-00805f9b34fb"), PansBleApiCore.gapServiceUuid)
    assertEquals("00002902-0000-1000-8000-00805f9b34fb", PansBleApiCore.CCCD_UUID_STRING)
    assertEquals(UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"), PansBleApiCore.cccdUuid)

    assertEquals(5, PansBleApiCore.requiredCommonCharacteristicUuids.size)
    assertTrue(PansBleApiCore.requiredCommonCharacteristicUuids.contains(PansBleApiCore.operationModeUuid))
    assertTrue(PansBleApiCore.requiredCommonCharacteristicUuids.contains(PansBleApiCore.networkIdUuid))
    assertTrue(PansBleApiCore.requiredCommonCharacteristicUuids.contains(PansBleApiCore.locationDataModeUuid))
    assertTrue(PansBleApiCore.requiredCommonCharacteristicUuids.contains(PansBleApiCore.locationDataUuid))
    assertTrue(PansBleApiCore.requiredCommonCharacteristicUuids.contains(PansBleApiCore.deviceInfoUuid))
  }

  @Test
  fun androidCapabilitiesDescribeBluetoothGattSupport() {
    val capabilities = PansBleApiCore.androidCapabilities

    assertEquals("ble", capabilities["transport"])
    assertEquals(true, capabilities["supportsScanning"])
    assertEquals(true, capabilities["supportsConnection"])
    assertEquals(true, capabilities["supportsNotifications"])
    assertEquals(true, capabilities["supportsMtuRequest"])
    assertEquals(false, capabilities["supportsMaximumWriteValueLength"])
  }

  @Test
  fun payloadValidationAcceptsBytesAndPreservesOrder() {
    assertUnsignedBytes(emptyList(), PansBleApiCore.validatePayload(emptyList()))
    assertUnsignedBytes(
      listOf(0, 1, 127, 128, 255),
      PansBleApiCore.validatePayload(listOf(0, 1, 127, 128, 255)),
    )
  }

  @Test
  fun payloadValidationRejectsOutOfRangeValues() {
    assertFailsWith<IllegalArgumentException> {
      PansBleApiCore.validatePayload(listOf(-1))
    }
    assertFailsWith<IllegalArgumentException> {
      PansBleApiCore.validatePayload(listOf(256))
    }
  }

  @Test
  fun uuidNormalizationAcceptsCanonicalValuesAndRejectsMalformedValues() {
    val canonical = "680c21d9-c946-4c1f-9c11-baa1c21329e7"

    assertEquals(canonical, PansBleApiCore.normalizeUuidString(canonical))
    assertEquals(canonical, PansBleApiCore.normalizeUuidString(canonical.uppercase()))
    assertEquals(UUID.fromString(canonical), PansBleApiCore.parseUuid(canonical))
    assertFailsWith<IllegalArgumentException> {
      PansBleApiCore.normalizeUuidString("")
    }
    assertFailsWith<IllegalArgumentException> {
      PansBleApiCore.normalizeUuidString(" \n\t ")
    }
    assertFailsWith<IllegalArgumentException> {
      PansBleApiCore.normalizeUuidString("not-a-uuid")
    }
    assertFailsWith<IllegalArgumentException> {
      PansBleApiCore.normalizeUuidString("2a00")
    }
  }

  @Test
  fun deviceIdNormalizationPreservesCurrentAndroidBehavior() {
    assertEquals("AA:BB:CC:DD:EE:FF", PansBleApiCore.normalizeDeviceId(" aa:bb:cc:dd:ee:ff "))
    assertFailsWith<IllegalArgumentException> {
      PansBleApiCore.normalizeDeviceId("  ")
    }

    // Best-judgment decision from the existing implementation: malformed-looking
    // IDs are uppercased here and rejected later by BluetoothAdapter if needed.
    assertEquals("NOT-A-MAC", PansBleApiCore.normalizeDeviceId("not-a-mac"))
  }

  @Test
  fun presenceServiceDataExtractionAndDecodingAreDefensive() {
    assertNull(PansBleApiCore.validPansServiceData(byteArrayOf()))
    assertNull(PansBleApiCore.validPansServiceData(byteArrayOf(0x9a.toByte())))
    assertNull(PansBleApiCore.decodePresence(byteArrayOf()))
    assertNull(PansBleApiCore.decodePresence(byteArrayOf(0x9a.toByte())))

    val serviceData = linkedMapOf(
      PansBleApiCore.pansServiceUuid to byteArrayOf(0x9a.toByte(), 0x07, 0xff.toByte()),
    )
    assertUnsignedBytes(
      listOf(0x9a, 0x07, 0xff),
      assertNotNull(PansBleApiCore.extractPansServiceData(serviceData)),
    )
  }

  @Test
  fun rawAdvertisementFallbackExtractsPansPresenceServiceData() {
    val scanRecord = byteArrayOf(
      0x02, 0x01, 0x06,
      0x13, 0x21,
      0xe7.toByte(), 0x29, 0x13, 0xc2.toByte(),
      0xa1.toByte(), 0xba.toByte(), 0x11, 0x9c.toByte(),
      0x1f, 0x4c, 0x46, 0xc9.toByte(),
      0xd9.toByte(), 0x21, 0x0c, 0x68,
      0x9a.toByte(), 0x07,
      0x00,
    )

    assertUnsignedBytes(
      listOf(0x9a, 0x07),
      assertNotNull(PansBleApiCore.extractPansServiceDataFromScanRecord(scanRecord)),
    )

    val differentService = scanRecord.copyOf().also { it[5] = 0x00 }
    assertNull(PansBleApiCore.extractPansServiceDataFromScanRecord(differentService))
    assertNull(
      PansBleApiCore.extractPansServiceDataFromScanRecord(
        byteArrayOf(0x13, 0x21, 0xe7.toByte()),
      ),
    )
  }

  @Test
  fun presenceDecoderMatchesCurrentNativeEventContract() {
    val tag = assertNotNull(PansBleApiCore.decodePresence(byteArrayOf(0x00, 0x00)))
    assertEquals(listOf(0x00, 0x00), tag["raw"])
    assertEquals(0, tag["rawOperationModeByte"])
    assertEquals(0, tag["rawUwbModeBits"])
    assertEquals("tag", tag["role"])
    assertEquals("off", tag["uwbMode"])
    assertEquals(0, tag["changeCounter"])

    val anchor = assertNotNull(PansBleApiCore.decodePresence(byteArrayOf(0x9a.toByte(), 0x07, 0xff.toByte())))
    assertEquals(listOf(0x9a, 0x07, 0xff), anchor["raw"])
    assertEquals(0x9a, anchor["rawOperationModeByte"])
    assertEquals(2, anchor["rawUwbModeBits"])
    assertEquals("anchor", anchor["role"])
    assertEquals(true, anchor["errorIndicated"])
    assertEquals(true, anchor["initiator"])
    assertEquals(false, anchor["bridge"])
    assertEquals("active", anchor["uwbMode"])
    assertEquals(7, anchor["changeCounter"])

    val unknownMode = assertNotNull(PansBleApiCore.decodePresence(byteArrayOf(0x03, 0x01)))
    assertEquals(3, unknownMode["rawUwbModeBits"])
    assertFalse(unknownMode.containsKey("uwbMode"))
  }

  @Test
  fun connectionValidationDoesNotRequireBluetoothHardware() {
    assertEquals(
      PansBleApiCore.requiredCommonCharacteristicUuids.size,
      PansBleApiCore.missingRequiredCharacteristics(emptyList()).size,
    )
    assertTrue(
      PansBleApiCore.missingRequiredCharacteristics(PansBleApiCore.requiredCommonCharacteristicUuids).isEmpty(),
    )
  }

  @Test
  fun permissionSelectionDependsOnSdkLevel() {
    assertEquals(
      listOf("android.permission.ACCESS_FINE_LOCATION"),
      PansBleApiCore.requiredPermissionsForSdk(30),
    )
    assertEquals(
      listOf(
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ),
      PansBleApiCore.requiredPermissionsForSdk(31),
    )
  }

  private fun assertUnsignedBytes(expected: List<Int>, actual: ByteArray) {
    assertEquals(expected, actual.map { it.toInt() and 0xff })
  }
}
