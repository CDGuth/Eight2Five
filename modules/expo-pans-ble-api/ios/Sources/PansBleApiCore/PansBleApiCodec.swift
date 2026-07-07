import Foundation

public enum PansBleApiCodecError: Error, Equatable, LocalizedError {
  case invalidPayloadByte(Int)
  case invalidUuid(String)

  public var errorDescription: String? {
    switch self {
    case .invalidPayloadByte:
      return "Payload must contain byte values in range 0..255."
    case .invalidUuid(let value):
      return "Invalid canonical 128-bit UUID: \(value)"
    }
  }
}

public enum PansBleApiConnectionValidation: Equatable {
  case valid
  case missingPansService
  case missingCharacteristics([String])
}

public enum PansBleApiCodec {
  public static func validatePayload(_ payload: [Int]) throws -> Data {
    var bytes = [UInt8]()
    bytes.reserveCapacity(payload.count)

    for value in payload {
      guard 0...255 ~= value else {
        throw PansBleApiCodecError.invalidPayloadByte(value)
      }
      bytes.append(UInt8(value))
    }

    return Data(bytes)
  }

  public static func normalizeUuidString(_ value: String) throws -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, let uuid = UUID(uuidString: trimmed) else {
      throw PansBleApiCodecError.invalidUuid(value)
    }
    return uuid.uuidString.lowercased()
  }

  public static func validPansServiceData(_ data: Data?) -> Data? {
    guard let data, data.count >= 2 else { return nil }
    return data
  }

  public static func extractPansServiceData(_ serviceDataByUuid: [String: Data]) -> Data? {
    for (uuidString, data) in serviceDataByUuid {
      guard let normalized = try? normalizeUuidString(uuidString),
            normalized == PansBleApiConstants.pansServiceUuid else { continue }
      return validPansServiceData(data)
    }

    return nil
  }

  public static func decodePresence(_ data: Data) -> [String: Any]? {
    decodePresence(Array(data))
  }

  public static func decodePresence(_ bytes: [UInt8]) -> [String: Any]? {
    guard bytes.count >= 2 else { return nil }

    let op = Int(bytes[0])
    let uwbBits = op & 0x03
    var presence: [String: Any] = [
      "raw": bytes.map { Int($0) },
      "rawOperationModeByte": op,
      "rawUwbModeBits": uwbBits,
      "role": (op & 0x80) != 0 ? "anchor" : "tag",
      "errorIndicated": (op & 0x10) != 0,
      "initiator": (op & 0x08) != 0,
      "bridge": (op & 0x04) != 0,
      "changeCounter": Int(bytes[1]),
    ]

    switch uwbBits {
    case 0: presence["uwbMode"] = "off"
    case 1: presence["uwbMode"] = "passive"
    case 2: presence["uwbMode"] = "active"
    default: break
    }

    return presence
  }

  public static func validateConnection(
    serviceUuids: Set<String>,
    characteristicUuids: Set<String>
  ) -> PansBleApiConnectionValidation {
    let normalizedServices = Set(serviceUuids.compactMap { try? normalizeUuidString($0) })
    guard normalizedServices.contains(PansBleApiConstants.pansServiceUuid) else {
      return .missingPansService
    }

    let normalizedCharacteristics = Set(characteristicUuids.compactMap { try? normalizeUuidString($0) })
    let missing = PansBleApiConstants.requiredCommonCharacteristicUuids
      .filter { !normalizedCharacteristics.contains($0) }
      .sorted()

    return missing.isEmpty ? .valid : .missingCharacteristics(missing)
  }

  // TODO: Add native TLV/location-data decoding once the native module starts
  // parsing location characteristic payloads. The current native bridge preserves
  // raw characteristic bytes for TypeScript codecs to decode.
}
