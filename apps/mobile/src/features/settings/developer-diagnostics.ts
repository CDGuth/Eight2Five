import type {
  ManagedDevice,
  PansDiagnosticsResult,
} from "@eight2five/mobile/pans-manager";

import type { MobilePansSnapshot } from "../../pans/mobile-pans-store";

export interface DeveloperDiagnosticRow {
  readonly label: string;
  readonly value: string;
}

/** Produces the intentionally quality-free diagnostics shown in production. */
export function buildDeveloperDiagnosticRows(
  snapshot: MobilePansSnapshot,
): readonly DeveloperDiagnosticRow[] {
  const diagnostics = snapshot.hardwareDiagnostics;
  const position = snapshot.rawPosition;
  return [
    { label: "Connection state", value: snapshot.connectionState },
    {
      label: "Node ID",
      value:
        diagnostics?.deviceInfo?.nodeIdHex ??
        snapshot.rememberedTag?.nodeIdHex ??
        "Unavailable",
    },
    {
      label: "PAN ID",
      value:
        diagnostics?.panId === undefined
          ? (snapshot.rememberedTag?.lastKnownConfig?.panId?.toString() ??
            "Unavailable")
          : formatHex(diagnostics.panId, 4),
    },
    { label: "Firmware version", value: firmwareVersion(diagnostics) },
    { label: "Raw PANS X", value: formatMeters(position?.xMeters) },
    { label: "Raw PANS Y", value: formatMeters(position?.yMeters) },
    { label: "Raw PANS Z", value: formatMeters(position?.zMeters) },
    {
      label: "Last update",
      value: snapshot.lastUpdateAt
        ? new Date(snapshot.lastUpdateAt).toISOString()
        : "Never",
    },
    {
      label: "Effective update rate",
      value: `${snapshot.effectiveUpdateRateHz.toFixed(1)} Hz`,
    },
    {
      label: "Locally known anchors",
      value: snapshot.knownAnchors.length.toString(),
    },
    ...(snapshot.counters
      ? [
          {
            label: "Notification events",
            value: snapshot.counters.notificationEvents.toString(),
          },
          {
            label: "Decoded position frames",
            value: snapshot.counters.positionFrames.toString(),
          },
        ]
      : []),
    ...snapshot.diagnosticMessages.map((message, index) => ({
      label: `Stream diagnostic ${index + 1}`,
      value: message,
    })),
    ...(diagnostics?.warnings.map((warning) => ({
      label: `Hardware warning: ${warning.section}`,
      value: warning.message,
    })) ?? []),
    ...snapshot.knownAnchors.map(anchorDiagnosticRow),
  ];
}

function anchorDiagnosticRow(
  anchor: ManagedDevice,
  index: number,
): DeveloperDiagnosticRow {
  const position =
    anchor.lastKnownConfig?.role === "anchor"
      ? anchor.lastKnownConfig.position
      : undefined;
  return {
    label: `Cached anchor ${anchor.nodeIdHex ?? anchor.label ?? index + 1}`,
    value: position
      ? `${position.xMeters.toFixed(3)}, ${position.yMeters.toFixed(3)}, ${position.zMeters.toFixed(3)} m`
      : "Position unavailable",
  };
}

function firmwareVersion(
  diagnostics: PansDiagnosticsResult | undefined,
): string {
  if (!diagnostics?.deviceInfo) return "Unavailable";
  return diagnostics.operationMode.selectedFirmware === 2
    ? diagnostics.deviceInfo.firmware2Version.toString()
    : diagnostics.deviceInfo.firmware1Version.toString();
}

function formatMeters(value: number | undefined): string {
  return value === undefined ? "Unavailable" : `${value.toFixed(3)} m`;
}

function formatHex(value: number, width: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
}
