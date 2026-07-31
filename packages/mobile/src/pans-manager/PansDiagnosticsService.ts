import { normalizeManagerError } from "./errors";
import { PansDeviceSessionManager } from "./PansDeviceSessionManager";
import type {
  PansDiagnosticsResult,
  PansDiagnosticsSection,
  PansDiagnosticsWarning,
} from "./types";

export class PansDiagnosticsService {
  constructor(
    private readonly sessions: PansDeviceSessionManager,
    private readonly now: () => number = Date.now,
  ) {}

  async inspect(
    deviceId: string,
    transportDeviceId: string,
  ): Promise<PansDiagnosticsResult> {
    return await this.sessions.withConnectedDevice(
      transportDeviceId,
      async (session) => {
        // This read is deliberately required: it identifies the node role and
        // therefore determines whether tag-only characteristics are relevant.
        const operationMode = await session.readOperationMode();
        const warnings: PansDiagnosticsWarning[] = [];

        const label = await optionalRead("label", warnings, () =>
          session.readLabel(),
        );
        const panId = await optionalRead("pan", warnings, () =>
          session.readNetworkId(),
        );
        const deviceInfo = await optionalRead("deviceInfo", warnings, () =>
          session.readDeviceInfo(),
        );
        const locationDataMode =
          operationMode.role === "tag"
            ? await optionalRead("locationDataMode", warnings, () =>
                session.readLocationDataMode(),
              )
            : undefined;
        const updateRate =
          operationMode.role === "tag"
            ? await optionalRead("updateRate", warnings, () =>
                session.readTagUpdateRate(),
              )
            : undefined;
        const clusterInfo = await optionalRead("clusterInfo", warnings, () =>
          session.readClusterInfo(),
        );
        const anchorList = await optionalRead("anchorList", warnings, () =>
          session.readAnchorList(),
        );
        const statistics = await optionalRead("statistics", warnings, () =>
          session.readStatistics(),
        );
        const anchorMacStats = await optionalRead(
          "anchorMacStats",
          warnings,
          () => session.readAnchorMacStats(),
        );

        return {
          deviceId,
          transportDeviceId,
          capturedAt: this.now(),
          operationMode,
          ...(label !== undefined ? { label } : {}),
          ...(panId !== undefined ? { panId } : {}),
          ...(deviceInfo ? { deviceInfo } : {}),
          ...(locationDataMode !== undefined ? { locationDataMode } : {}),
          ...(updateRate ? { updateRate } : {}),
          ...(clusterInfo ? { clusterInfo } : {}),
          ...(anchorList ? { anchorList } : {}),
          ...(statistics ? { statistics } : {}),
          ...(anchorMacStats ? { anchorMacStats } : {}),
          warnings,
        };
      },
    );
  }
}

async function optionalRead<T>(
  section: PansDiagnosticsSection,
  warnings: PansDiagnosticsWarning[],
  read: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    const normalized = normalizeManagerError(error);
    warnings.push({
      section,
      code: normalized.code,
      message:
        normalized.code === "MISSING_CHARACTERISTIC"
          ? "This optional data is not exposed by the device."
          : `This optional data could not be read (${normalized.code}).`,
    });
    return undefined;
  }
}
