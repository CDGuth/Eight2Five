import { ManagerError, normalizeManagerError } from "../errors";

describe("ManagerError", () => {
  test.each([
    ["BLUETOOTH_UNAVAILABLE", "BLUETOOTH_DISABLED", false],
    ["NOT_CONNECTED", "DEVICE_OFFLINE", true],
    ["TIMEOUT", "CONNECTION_TIMEOUT", true],
    ["GATT_ERROR", "GATT_FAILURE", true],
    ["CHARACTERISTIC_NOT_FOUND", "MISSING_CHARACTERISTIC", false],
    ["MALFORMED_PAYLOAD", "INCOMPATIBLE_FIRMWARE", false],
  ])("maps native %s to %s", (nativeCode, managerCode, retryable) => {
    const cause = { code: nativeCode, message: "native failure" };
    expect(normalizeManagerError(cause)).toMatchObject({
      code: managerCode,
      cause,
      isRetryable: retryable,
    });
  });

  test("does not expose an unknown error stack as its public message", () => {
    const cause = new Error("sensitive implementation detail");
    const error = normalizeManagerError(cause, {
      deviceId: "device",
      operation: "inspect",
    });
    expect(error).toBeInstanceOf(ManagerError);
    expect(error).toMatchObject({
      code: "UNKNOWN",
      message: "The device operation failed.",
      deviceId: "device",
      operation: "inspect",
      cause,
    });
  });
});
