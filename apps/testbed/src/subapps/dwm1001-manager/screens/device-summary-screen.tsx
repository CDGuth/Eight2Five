import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  formatPanId,
  getDeviceDisplayName,
  getNetworkDisplayName,
  resolveCachedProfileMatch,
  type PansInspectionResult,
} from "@eight2five/mobile/pans-manager";
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
  const cachedPanId = device?.lastKnownConfig?.panId;
  const profileMatch = resolveCachedProfileMatch(manager.networks, cachedPanId);
  const matchingProfiles = profileMatch.matchingNetworkIds
    .map((networkId) =>
      manager.networks.find((network) => network.id === networkId),
    )
    .filter((network) => network !== undefined);
  const available = manager.discoveries.some(
    (discovery) =>
      discovery.transportDeviceId === device?.transportDeviceId &&
      discovery.stale !== true,
  );
  const [inspection, setInspection] = React.useState<PansInspectionResult>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [confirmingDestructiveAction, setConfirmingDestructiveAction] =
    React.useState(false);
  const [destructiveBusy, setDestructiveBusy] = React.useState(false);

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
  const runDestructiveAction = async () => {
    setDestructiveBusy(true);
    setError(undefined);
    try {
      if (available) {
        const result = await manager.unassignOnlineDevice(device.id);
        if (result.error) {
          setError(
            `${result.error.message} ${result.writes
              .map((write) => `${write.field}: ${write.status}`)
              .join(" · ")}`,
          );
          return;
        }
        setConfirmingDestructiveAction(false);
      } else {
        await manager.deleteOfflineDevice(device.id);
        router.replace(
          "/(subapps)/dwm1001-manager/(tabs)/networks-devices" as never,
        );
      }
    } catch (destructiveError) {
      setError(displayError(destructiveError));
    } finally {
      setDestructiveBusy(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard title={getDeviceDisplayName(device)}>
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
          label="Cached hardware PAN"
          value={
            cachedPanId === undefined ? "Unverified" : formatPanId(cachedPanId)
          }
        />
        <KeyValue
          label="Cached profile match"
          value={
            profileMatch.status === "matched"
              ? getNetworkDisplayName(matchingProfiles[0]!)
              : profileMatch.status === "conflict"
                ? `Conflict: ${matchingProfiles
                    .map(getNetworkDisplayName)
                    .join(", ")}`
                : profileMatch.status === "unverified"
                  ? "Unverified"
                  : "Unassigned"
          }
        />
        <KeyValue
          label="Hardware cache status"
          value={available ? "Device available" : "Cached · device offline"}
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

      <SectionCard
        title="Destructive actions"
        description={
          available
            ? "Makes UWB passive, verifies it, then writes and verifies Eight2Five's PAN 0 unassigned-device convention."
            : "Removes this saved phone record, snapshots, and position logs without contacting hardware."
        }
      >
        {confirmingDestructiveAction ? (
          <VStack space="sm">
            <StatePanel
              state="error"
              message={
                available
                  ? "Confirm hardware unassignment. The record is retained if verification is partial."
                  : "Confirm deletion of this saved device record. Rediscovery creates a new unassigned device."
              }
            />
            <ManagerButton
              testID="confirm-device-destructive-action"
              label={available ? "Unassign hardware" : "Delete saved device"}
              variant="destructive"
              loading={destructiveBusy}
              onPress={() => void runDestructiveAction()}
            />
            <ManagerButton
              label="Cancel"
              variant="ghost"
              isDisabled={destructiveBusy}
              onPress={() => setConfirmingDestructiveAction(false)}
            />
          </VStack>
        ) : (
          <ManagerButton
            testID="request-device-destructive-action"
            label={available ? "Unassign device" : "Delete saved device"}
            variant="destructive"
            onPress={() => setConfirmingDestructiveAction(true)}
          />
        )}
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
