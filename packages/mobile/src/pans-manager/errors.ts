import type { PansApiError, PansApiErrorCode } from "expo-pans-ble-api";

export type ManagerErrorCode =
  | "PERMISSION_DENIED"
  | "BLUETOOTH_DISABLED"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_OFFLINE"
  | "CONNECTION_TIMEOUT"
  | "GATT_FAILURE"
  | "INCOMPATIBLE_FIRMWARE"
  | "MISSING_CHARACTERISTIC"
  | "INVALID_CONFIGURATION"
  | "WRITE_FAILED"
  | "VERIFY_MISMATCH"
  | "OPERATION_CANCELLED"
  | "STORAGE_FAILURE"
  | "UNSUPPORTED_FEATURE"
  | "UNKNOWN";

export interface ManagerErrorOptions {
  deviceId?: string;
  operation?: string;
  cause?: unknown;
  isRetryable?: boolean;
  recovery?: string;
}

export class ManagerError extends Error {
  readonly code: ManagerErrorCode;
  readonly deviceId?: string;
  readonly operation?: string;
  override readonly cause?: unknown;
  readonly isRetryable: boolean;
  readonly recovery?: string;

  constructor(
    code: ManagerErrorCode,
    message: string,
    options: ManagerErrorOptions = {},
  ) {
    super(message);
    this.name = "ManagerError";
    this.code = code;
    this.deviceId = options.deviceId;
    this.operation = options.operation;
    this.cause = options.cause;
    this.isRetryable = options.isRetryable ?? retryableByCode(code);
    this.recovery = options.recovery;
  }
}

const NATIVE_CODE_MAP: Record<PansApiErrorCode, ManagerErrorCode> = {
  UNSUPPORTED: "UNSUPPORTED_FEATURE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  BLUETOOTH_UNAVAILABLE: "BLUETOOTH_DISABLED",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  NOT_CONNECTED: "DEVICE_OFFLINE",
  SERVICE_NOT_FOUND: "MISSING_CHARACTERISTIC",
  CHARACTERISTIC_NOT_FOUND: "MISSING_CHARACTERISTIC",
  INVALID_ARGUMENT: "INVALID_CONFIGURATION",
  MALFORMED_PAYLOAD: "INCOMPATIBLE_FIRMWARE",
  GATT_ERROR: "GATT_FAILURE",
  TIMEOUT: "CONNECTION_TIMEOUT",
  OPERATION_FAILED: "UNKNOWN",
};

export function normalizeManagerError(
  error: unknown,
  context: Omit<ManagerErrorOptions, "cause" | "isRetryable"> = {},
): ManagerError {
  if (error instanceof ManagerError) return error;
  const native = nativeError(error);
  if (native) {
    const code = NATIVE_CODE_MAP[native.code];
    return new ManagerError(code, safeNativeMessage(code, native.message), {
      ...context,
      cause: error,
      recovery: recoveryForCode(code),
    });
  }
  return new ManagerError("UNKNOWN", "The device operation failed.", {
    ...context,
    cause: error,
    recovery: recoveryForCode("UNKNOWN"),
  });
}

export function isTransientManagerError(error: unknown): boolean {
  return normalizeManagerError(error).isRetryable;
}

function nativeError(error: unknown): PansApiError | undefined {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<PansApiError>;
    if (isNativeCode(candidate.code)) {
      return {
        code: candidate.code,
        message: typeof candidate.message === "string" ? candidate.message : "",
      };
    }
  }
  if (error instanceof Error) {
    const prefix = error.message.split(":", 1)[0];
    if (isNativeCode(prefix)) return { code: prefix, message: error.message };
  }
  return undefined;
}

function isNativeCode(value: unknown): value is PansApiErrorCode {
  return typeof value === "string" && value in NATIVE_CODE_MAP;
}

function safeNativeMessage(
  code: ManagerErrorCode,
  nativeMessage: string,
): string {
  if (nativeMessage.trim() && !nativeMessage.includes("\n    at ")) {
    return nativeMessage;
  }
  switch (code) {
    case "PERMISSION_DENIED":
      return "Bluetooth permission is required.";
    case "BLUETOOTH_DISABLED":
      return "Bluetooth is disabled or unavailable.";
    case "DEVICE_NOT_FOUND":
      return "The device could not be found.";
    case "CONNECTION_TIMEOUT":
      return "The device connection timed out.";
    case "MISSING_CHARACTERISTIC":
      return "The device does not expose a required characteristic.";
    default:
      return "The device operation failed.";
  }
}

function retryableByCode(code: ManagerErrorCode): boolean {
  return (
    code === "DEVICE_OFFLINE" ||
    code === "CONNECTION_TIMEOUT" ||
    code === "GATT_FAILURE"
  );
}

function recoveryForCode(code: ManagerErrorCode): string | undefined {
  if (code === "PERMISSION_DENIED")
    return "Grant Bluetooth permission and retry.";
  if (code === "BLUETOOTH_DISABLED") return "Enable Bluetooth and retry.";
  if (retryableByCode(code)) return "Move closer to the device and retry.";
  return undefined;
}
