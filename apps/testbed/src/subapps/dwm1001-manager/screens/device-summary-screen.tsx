import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { PansInspectionResult } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

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
  const manager = usePansManager();
  const device = useManagedDevice(deviceId);
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
        description="Hardware inspection only occurs when Refresh from device is pressed."
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
            label="Initiator"
            value={inspection.operationMode.initiatorEnabled ? "On" : "Off"}
          />
          <KeyValue
            label="LED"
            value={inspection.operationMode.ledEnabled ? "On" : "Off"}
          />
          <KeyValue
            label="Firmware 1"
            value={inspection.deviceInfo?.firmware1Version ?? "Unavailable"}
          />
          <KeyValue
            label="Firmware 2"
            value={inspection.deviceInfo?.firmware2Version ?? "Unavailable"}
          />
          {inspection.updateRate ? (
            <Text selectable className="text-sm text-gray-600">
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
