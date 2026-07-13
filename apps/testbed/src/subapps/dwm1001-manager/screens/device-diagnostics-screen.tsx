import React from "react";
import { useLocalSearchParams } from "expo-router";
import type { PansDiagnosticsResult } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/text";
import { eight2FiveRadii, useEight2FiveTheme } from "@eight2five/ui/theme";

import { useManagedDevice, usePansManager } from "../manager-context";
import { bytesToHex } from "../manager-utils";
import {
  KeyValue,
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";

export function DeviceDiagnosticsScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const theme = useEight2FiveTheme();
  const manager = usePansManager();
  const device = useManagedDevice(deviceId);
  const advertisement = manager.discoveries.find(
    (item) => item.transportDeviceId === device?.transportDeviceId,
  );
  const [diagnostics, setDiagnostics] = React.useState<PansDiagnosticsResult>();
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
      setDiagnostics(await manager.inspectDiagnostics(device.id));
    } catch {
      setError(
        "Unable to read the required operation mode. Check the device connection and retry.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Advertisement"
        description="Most recent nearby-device data."
      >
        <KeyValue
          label="BLE name"
          value={advertisement?.name ?? "Unavailable"}
        />
        <KeyValue
          label="Transport ID"
          value={advertisement?.transportDeviceId ?? device.transportDeviceId}
        />
        <KeyValue
          label="MAC address"
          value={advertisement?.macAddress ?? "Unavailable on this platform"}
        />
        <KeyValue
          label="RSSI"
          value={advertisement ? `${advertisement.rssi} dBm` : "Not nearby"}
        />
        <KeyValue
          label="Compatibility"
          value={advertisement?.compatibility ?? "Unknown"}
        />
        <KeyValue
          label="Role"
          value={advertisement?.presence?.role ?? "Unavailable"}
        />
        <KeyValue
          label="UWB mode"
          value={advertisement?.presence?.uwbMode ?? "Unavailable"}
        />
        <KeyValue
          label="Initiator"
          value={advertisement?.presence?.initiator ? "Yes" : "No"}
        />
        <KeyValue
          label="Bridge"
          value={advertisement?.presence?.bridge ? "Yes" : "No"}
        />
        <KeyValue
          label="Error indicated"
          value={advertisement?.presence?.errorIndicated ? "Yes" : "No"}
        />
        <KeyValue
          label="Change counter"
          value={advertisement?.presence?.changeCounter ?? "Unavailable"}
        />
        <KeyValue
          label="Raw presence hex"
          value={bytesToHex(advertisement?.presence?.raw)}
        />
        {advertisement?.reason ? (
          <StatePanel state="info" message={advertisement.reason} />
        ) : null}
      </SectionCard>

      <SectionCard
        title="Connected diagnostics"
        description="Refresh to connect and read the device."
      >
        <ManagerButton
          label="Refresh diagnostics"
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
        {diagnostics ? (
          <>
            <KeyValue
              label="Captured"
              value={new Date(diagnostics.capturedAt).toISOString()}
            />
            <KeyValue
              label="Label"
              value={diagnostics.label ?? "Unavailable"}
            />
            <KeyValue
              label="PAN"
              value={
                diagnostics.panId === undefined
                  ? "Unavailable"
                  : formatHex(diagnostics.panId, 4)
              }
            />
          </>
        ) : null}
      </SectionCard>

      {diagnostics ? (
        <>
          <SectionCard title="Operation">
            <KeyValue label="Role" value={diagnostics.operationMode.role} />
            <KeyValue
              label="UWB mode"
              value={diagnostics.operationMode.uwbMode}
            />
            <KeyValue
              label="Active firmware slot"
              value={diagnostics.operationMode.selectedFirmware}
            />
            <KeyValue
              label="Location engine"
              value={onOff(diagnostics.operationMode.locationEngineEnabled)}
            />
            <KeyValue
              label="Low power"
              value={onOff(diagnostics.operationMode.lowPowerModeEnabled)}
            />
            <KeyValue
              label="Accelerometer / stationary detection"
              value={onOff(diagnostics.operationMode.accelerometerEnabled)}
            />
            <KeyValue
              label="Firmware update participation"
              value={onOff(diagnostics.operationMode.firmwareUpdateEnabled)}
            />
            <KeyValue
              label="Initiator"
              value={onOff(diagnostics.operationMode.initiatorEnabled)}
            />
            <KeyValue
              label="LED"
              value={onOff(diagnostics.operationMode.ledEnabled)}
            />
            <KeyValue
              label="Location data mode"
              value={diagnostics.locationDataMode ?? "Unavailable"}
            />
            <KeyValue
              label="Moving update interval"
              value={
                diagnostics.updateRate
                  ? `${diagnostics.updateRate.movingUpdateRateMs} ms`
                  : "Unavailable"
              }
            />
            <KeyValue
              label="Stationary update interval"
              value={
                diagnostics.updateRate
                  ? `${diagnostics.updateRate.stationaryUpdateRateMs} ms`
                  : "Unavailable"
              }
            />
            <KeyValue
              label="Raw operation"
              value={bytesToHex(diagnostics.operationMode.raw)}
            />
            <KeyValue
              label="Raw update rate"
              value={bytesToHex(diagnostics.updateRate?.raw)}
            />
          </SectionCard>

          <SectionCard title="Device information and firmware">
            <KeyValue
              label="Node ID"
              value={diagnostics.deviceInfo?.nodeIdHex ?? "Unavailable"}
            />
            <KeyValue
              label="Hardware version"
              value={diagnostics.deviceInfo?.hardwareVersion ?? "Unavailable"}
            />
            <KeyValue
              label="Firmware slot 1 version"
              value={diagnostics.deviceInfo?.firmware1Version ?? "Unavailable"}
            />
            <KeyValue
              label="Firmware slot 1 checksum"
              value={formatOptionalHex(
                diagnostics.deviceInfo?.firmware1Checksum,
                8,
              )}
            />
            <KeyValue
              label="Firmware slot 2 version"
              value={diagnostics.deviceInfo?.firmware2Version ?? "Unavailable"}
            />
            <KeyValue
              label="Firmware slot 2 checksum"
              value={formatOptionalHex(
                diagnostics.deviceInfo?.firmware2Checksum,
                8,
              )}
            />
            <KeyValue
              label="Operation flags"
              value={formatOptionalHex(
                diagnostics.deviceInfo?.operationFlags,
                2,
              )}
            />
            <KeyValue
              label="Raw device info"
              value={bytesToHex(diagnostics.deviceInfo?.raw)}
            />
          </SectionCard>

          <SectionCard title="Cluster">
            <KeyValue
              label="Seat number"
              value={diagnostics.clusterInfo?.seatNumber ?? "Unavailable"}
            />
            <KeyValue
              label="Cluster map"
              value={formatOptionalHex(diagnostics.clusterInfo?.clusterMap)}
            />
            <KeyValue
              label="Neighbor map"
              value={formatOptionalHex(
                diagnostics.clusterInfo?.clusterNeighborMap,
              )}
            />
            <KeyValue
              label="Raw cluster info"
              value={bytesToHex(diagnostics.clusterInfo?.raw)}
            />
          </SectionCard>

          <SectionCard title="Anchor list">
            <KeyValue
              label="Anchors"
              value={
                diagnostics.anchorList?.anchors.length
                  ? diagnostics.anchorList.anchors
                      .map((anchor) => anchor.nodeIdHex)
                      .join(", ")
                  : "Unavailable or empty"
              }
            />
            <KeyValue
              label="Raw anchor list"
              value={bytesToHex(diagnostics.anchorList?.raw)}
            />
            {diagnostics.anchorList?.diagnostics.map((message, index) => (
              <StatePanel
                key={`${index}-${message}`}
                state="info"
                message={message}
              />
            ))}
          </SectionCard>

          <SectionCard title="Statistics">
            <KeyValue
              label="Statistics hex"
              value={bytesToHex(diagnostics.statistics)}
            />
            <KeyValue
              label="Anchor MAC statistics hex"
              value={bytesToHex(diagnostics.anchorMacStats)}
            />
          </SectionCard>

          {diagnostics.warnings.length ? (
            <SectionCard title="Warnings">
              {diagnostics.warnings.map((warning, index) => (
                <StatePanel
                  key={`${warning.section}-${index}`}
                  state="info"
                  message={`${warning.section}: ${warning.message}`}
                />
              ))}
            </SectionCard>
          ) : null}
        </>
      ) : null}

      <SectionCard title="Raw export">
        <Text
          selectable
          size="xs"
          style={{
            borderRadius: eight2FiveRadii.sm,
            backgroundColor: theme.surface,
            color: theme.text,
            fontFamily: "monospace",
            padding: 12,
          }}
        >
          {JSON.stringify({ advertisement, diagnostics }, null, 2)}
        </Text>
        <ManagerButton label="Copy unavailable" variant="outline" isDisabled />
        <ManagerButton
          label="File export unavailable"
          variant="outline"
          isDisabled
        />
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          Clipboard and file export are not configured.
        </Text>
      </SectionCard>
    </ManagerScreen>
  );
}

function onOff(value: boolean): string {
  return value ? "On" : "Off";
}

function formatHex(value: number, width = 0): string {
  return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
}

function formatOptionalHex(value: number | undefined, width = 0): string {
  return value === undefined ? "Unavailable" : formatHex(value, width);
}
