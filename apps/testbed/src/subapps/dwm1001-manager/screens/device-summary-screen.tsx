import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { PansInspectionResult } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import { useManagedDevice, usePansManager } from "../manager-context";
import { displayError, formatRelativeTime } from "../manager-utils";
import {
  KeyValue,
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";

export function DeviceSummaryScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const manager = usePansManager();
  const device = useManagedDevice(deviceId);
  const network = manager.networks.find(
    (item) => item.id === device?.networkId,
  );
  const [inspection, setInspection] = React.useState<PansInspectionResult>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();

  if (!device) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Managed device not found." />
      </ManagerScreen>
    );
  }

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setInspection(await manager.inspectDevice(device.id));
    } catch (inspectError) {
      setError(displayError(inspectError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title={device.nickname || device.label || "DWM1001 device"}
        description="Refresh to read the current device configuration."
      >
        <KeyValue label="Transport ID" value={device.transportDeviceId} />
        <KeyValue
          label="MAC"
          value={device.macAddress ?? "Unavailable on this platform"}
        />
        <KeyValue label="Node ID" value={device.nodeIdHex ?? "Unknown"} />
        <KeyValue
          label="Saved role"
          value={device.role ?? "Pending inspection"}
        />
        <KeyValue
          label="Saved network association"
          value={
            network?.name ?? (device.networkId ? device.networkId : "None")
          }
        />
        <KeyValue
          label="Saved position"
          value={formatSavedPosition(device.lastKnownConfig)}
        />
        <KeyValue
          label="Last seen"
          value={formatRelativeTime(device.lastSeenAt)}
        />
        <ManagerButton
          label="Refresh from device"
          loading={loading}
          onPress={() => void refresh()}
        />
        {error ? (
          <StatePanel
            state="error"
            message={error}
            onRetry={() => void refresh()}
          />
        ) : null}
      </SectionCard>

      {inspection ? (
        <SectionCard title="Live device details">
          <KeyValue label="Label" value={inspection.label ?? "Unavailable"} />
          <KeyValue
            label="PAN"
            value={
              inspection.panId === undefined
                ? "Unavailable"
                : `0x${inspection.panId
                    .toString(16)
                    .toUpperCase()
                    .padStart(4, "0")}`
            }
          />
          <KeyValue label="Role" value={inspection.operationMode.role} />
          <KeyValue label="UWB" value={inspection.operationMode.uwbMode} />
          <KeyValue
            label="Active firmware slot"
            value={inspection.operationMode.selectedFirmware}
          />
          <KeyValue
            label="Initiator"
            value={inspection.operationMode.initiatorEnabled ? "On" : "Off"}
          />
          <KeyValue
            label="LED"
            value={inspection.operationMode.ledEnabled ? "On" : "Off"}
          />
          <KeyValue
            label="Location engine"
            value={
              inspection.operationMode.locationEngineEnabled ? "On" : "Off"
            }
          />
          <KeyValue
            label="Low power"
            value={inspection.operationMode.lowPowerModeEnabled ? "On" : "Off"}
          />
          <KeyValue
            label="Accelerometer / stationary detection"
            value={inspection.operationMode.accelerometerEnabled ? "On" : "Off"}
          />
          <KeyValue
            label="Firmware update participation"
            value={
              inspection.operationMode.firmwareUpdateEnabled ? "On" : "Off"
            }
          />
          <KeyValue
            label="Hardware version"
            value={inspection.deviceInfo?.hardwareVersion ?? "Unavailable"}
          />
          <KeyValue
            label="Firmware 1"
            value={inspection.deviceInfo?.firmware1Version ?? "Unavailable"}
          />
          <KeyValue
            label="Firmware 2"
            value={inspection.deviceInfo?.firmware2Version ?? "Unavailable"}
          />
          <KeyValue
            label="Firmware 1 checksum"
            value={formatChecksum(inspection.deviceInfo?.firmware1Checksum)}
          />
          <KeyValue
            label="Firmware 2 checksum"
            value={formatChecksum(inspection.deviceInfo?.firmware2Checksum)}
          />
          {inspection.updateRate ? (
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              Update rates (read-only): moving{" "}
              {inspection.updateRate.movingUpdateRateMs} ms, stationary{" "}
              {inspection.updateRate.stationaryUpdateRateMs} ms.
            </Text>
          ) : null}
          {inspection.warnings.map((warning) => (
            <StatePanel key={warning} state="info" message={warning} />
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title="Actions">
        <VStack space="sm">
          <ManagerButton
            label="Edit configuration"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/devices/${device.id}/edit` as never,
              )
            }
          />
          <ManagerButton
            label="Diagnostics"
            variant="outline"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/devices/${device.id}/diagnostics` as never,
              )
            }
          />
          <ManagerButton
            label="Disconnect"
            variant="ghost"
            onPress={() => void manager.disconnectDevice(device.id)}
          />
        </VStack>
      </SectionCard>
    </ManagerScreen>
  );
}

function formatChecksum(value: number | undefined): string {
  return value === undefined
    ? "Unavailable"
    : `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function formatSavedPosition(
  config:
    | import("@eight2five/mobile/pans-manager").ManagedDeviceConfig
    | undefined,
): string {
  if (config?.role !== "anchor" || !config.position) return "None";
  return `${config.position.xMeters} m, ${config.position.yMeters} m, ${config.position.zMeters} m`;
}
