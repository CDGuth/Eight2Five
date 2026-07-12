import { ManagerError } from "./errors";

/** Firmware execution is deliberately disabled until a separately reviewed transport is shipped. */
export const ENABLE_DWM1001_FIRMWARE_UPDATE = false;

export interface FirmwareUpdateRequest {
  deviceId: string;
  firmwareVersion: number;
  binary: Uint8Array;
}

export class PansFirmwareUpdateService {
  isEnabled(): boolean {
    return ENABLE_DWM1001_FIRMWARE_UPDATE;
  }

  async updateFirmware(_request: FirmwareUpdateRequest): Promise<never> {
    throw new ManagerError(
      "UNSUPPORTED_FEATURE",
      "DWM1001 firmware updates are disabled in this release.",
    );
  }
}
