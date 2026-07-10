import XCTest
@testable import PansBleApiCore

final class PansBleApiCodecTests: XCTestCase {
  func testConstantsMatchDocumentedPansGattUuids() {
    XCTAssertEqual(PansBleApiConstants.pansServiceUuid, "680c21d9-c946-4c1f-9c11-baa1c21329e7")
    XCTAssertEqual(PansBleApiConstants.gapServiceUuid, "00001800-0000-1000-8000-00805f9b34fb")
    XCTAssertEqual(PansBleApiConstants.requiredCommonCharacteristicUuids.count, 5)
    XCTAssertEqual(PansBleApiConstants.requiredCommonCharacteristicUuids, [
      PansBleApiConstants.Characteristics.operationMode,
      PansBleApiConstants.Characteristics.networkId,
      PansBleApiConstants.Characteristics.locationDataMode,
      PansBleApiConstants.Characteristics.locationData,
      PansBleApiConstants.Characteristics.deviceInfo,
    ])
  }

  func testIosCapabilitiesDescribeCoreBluetoothSupport() {
    let capabilities = PansBleApiConstants.iosCapabilities

    XCTAssertEqual(capabilities["transport"] as? String, "ble")
    XCTAssertEqual(capabilities["supportsScanning"] as? Bool, true)
    XCTAssertEqual(capabilities["supportsConnection"] as? Bool, true)
    XCTAssertEqual(capabilities["supportsNotifications"] as? Bool, true)
    XCTAssertEqual(capabilities["supportsMtuRequest"] as? Bool, false)
    XCTAssertEqual(capabilities["supportsMaximumWriteValueLength"] as? Bool, true)
  }

  func testPayloadValidationAcceptsBytesAndPreservesOrder() throws {
    XCTAssertEqual(Array(try PansBleApiCodec.validatePayload([])), [])
    XCTAssertEqual(
      Array(try PansBleApiCodec.validatePayload([0, 1, 127, 128, 255])),
      [0, 1, 127, 128, 255]
    )

    XCTAssertThrowsError(try PansBleApiCodec.validatePayload([-1]))
    XCTAssertThrowsError(try PansBleApiCodec.validatePayload([256]))
  }

  func testUuidNormalizationAcceptsCanonicalValuesAndRejectsMalformedValues() throws {
    let canonical = "680c21d9-c946-4c1f-9c11-baa1c21329e7"

    XCTAssertEqual(try PansBleApiCodec.normalizeUuidString(canonical), canonical)
    XCTAssertEqual(try PansBleApiCodec.normalizeUuidString(canonical.uppercased()), canonical)
    XCTAssertThrowsError(try PansBleApiCodec.normalizeUuidString(""))
    XCTAssertThrowsError(try PansBleApiCodec.normalizeUuidString("   \n\t  "))
    XCTAssertThrowsError(try PansBleApiCodec.normalizeUuidString("not-a-uuid"))
    XCTAssertThrowsError(try PansBleApiCodec.normalizeUuidString("2a00"))
  }

  func testPresenceServiceDataExtractionAndDecodingAreDefensive() {
    XCTAssertNil(PansBleApiCodec.validPansServiceData(Data()))
    XCTAssertNil(PansBleApiCodec.validPansServiceData(Data([0x9a])))
    XCTAssertNil(PansBleApiCodec.decodePresence(Data()))
    XCTAssertNil(PansBleApiCodec.decodePresence(Data([0x9a])))

    let extracted = PansBleApiCodec.extractPansServiceData([
      PansBleApiConstants.pansServiceUuid.uppercased(): Data([0x9a, 0x07, 0xff]),
    ])

    XCTAssertEqual(extracted, Data([0x9a, 0x07, 0xff]))
  }

  func testPresenceDecoderMatchesCurrentNativeEventContract() throws {
    let tag = try XCTUnwrap(PansBleApiCodec.decodePresence(Data([0x00, 0x00])))
    XCTAssertEqual(tag["raw"] as? [Int], [0x00, 0x00])
    XCTAssertEqual(tag["rawOperationModeByte"] as? Int, 0)
    XCTAssertEqual(tag["rawUwbModeBits"] as? Int, 0)
    XCTAssertEqual(tag["role"] as? String, "tag")
    XCTAssertEqual(tag["uwbMode"] as? String, "off")
    XCTAssertEqual(tag["changeCounter"] as? Int, 0)

    let anchor = try XCTUnwrap(PansBleApiCodec.decodePresence(Data([0x9a, 0x07, 0xff])))
    XCTAssertEqual(anchor["raw"] as? [Int], [0x9a, 0x07, 0xff])
    XCTAssertEqual(anchor["rawOperationModeByte"] as? Int, 0x9a)
    XCTAssertEqual(anchor["rawUwbModeBits"] as? Int, 2)
    XCTAssertEqual(anchor["role"] as? String, "anchor")
    XCTAssertEqual(anchor["errorIndicated"] as? Bool, true)
    XCTAssertEqual(anchor["initiator"] as? Bool, true)
    XCTAssertEqual(anchor["bridge"] as? Bool, false)
    XCTAssertEqual(anchor["uwbMode"] as? String, "active")
    XCTAssertEqual(anchor["changeCounter"] as? Int, 7)

    let unknownMode = try XCTUnwrap(PansBleApiCodec.decodePresence(Data([0x03, 0x01])))
    XCTAssertEqual(unknownMode["rawUwbModeBits"] as? Int, 3)
    XCTAssertFalse(unknownMode.keys.contains("uwbMode"))
  }

  func testConnectionValidationDoesNotRequireBluetoothHardware() {
    XCTAssertEqual(
      PansBleApiCodec.validateConnection(serviceUuids: [], characteristicUuids: []),
      .missingPansService
    )

    XCTAssertEqual(
      PansBleApiCodec.validateConnection(
        serviceUuids: [PansBleApiConstants.pansServiceUuid],
        characteristicUuids: PansBleApiConstants.requiredCommonCharacteristicUuids
      ),
      .valid
    )

    let missingDeviceInfo = PansBleApiConstants.requiredCommonCharacteristicUuids.subtracting([
      PansBleApiConstants.Characteristics.deviceInfo,
    ])

    XCTAssertEqual(
      PansBleApiCodec.validateConnection(
        serviceUuids: [PansBleApiConstants.pansServiceUuid],
        characteristicUuids: missingDeviceInfo
      ),
      .missingCharacteristics([PansBleApiConstants.Characteristics.deviceInfo])
    )
  }
}
