import React from "react";
import type {
  DeviceConfigurationSnapshot,
  DisplayDevice,
  ManagedDeviceConfig,
  ManagedNetwork,
  PansInspectionResult,
} from "@eight2five/mobile/pans-manager";
import {
  formatMapDistance,
  formatPanId,
  getNetworkDisplayName,
} from "@eight2five/mobile/pans-manager";
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIcon,
  AccordionItem,
  AccordionTrigger,
} from "@eight2five/ui/components/accordion";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Divider } from "@eight2five/ui/components/divider";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  BluetoothOff,
  ChevronDown,
  RefreshCw,
  Settings,
} from "lucide-react-native";

import { displayError } from "../manager-utils";
import { getRssiSignalIcon } from "../rssi-signal";
import { SettingInfoCard } from "./setting-help";

export interface NetworkDeviceRowProps {
  device: DisplayDevice;
  network?: ManagedNetwork;
  snapshot?: DeviceConfigurationSnapshot;
  expanded: boolean;
  onExpandedChange(expanded: boolean): void;
  onOpenSettings(): Promise<void>;
  onRefresh?(): Promise<PansInspectionResult>;
}

export function NetworkDeviceRow({
  device,
  network,
  snapshot,
  expanded,
  onExpandedChange,
  onOpenSettings,
  onRefresh,
}: NetworkDeviceRowProps) {
  const theme = useEight2FiveTheme();
  const [settingsLoading, setSettingsLoading] = React.useState(false);
  const [settingsError, setSettingsError] = React.useState<string>();
  const [refreshLoading, setRefreshLoading] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string>();
  const [refreshResult, setRefreshResult] =
    React.useState<PansInspectionResult>();
  const rawRssi = device.discovery?.rssi;
  const stale = device.discovery?.stale === true;
  const RssiIcon = getRssiSignalIcon(rawRssi, stale);
  const rssiMuted = stale || !Number.isFinite(rawRssi);
  const rssiLabel = Number.isFinite(rawRssi)
    ? `RSSI ${rawRssi} dBm${stale ? ", stale" : ""}`
    : "RSSI unavailable";
  const profileStatus = profileStatusLabel(device);

  const openSettings = async () => {
    setSettingsLoading(true);
    setSettingsError(undefined);
    try {
      await onOpenSettings();
    } catch (error) {
      setSettingsError(displayError(error));
    } finally {
      setSettingsLoading(false);
    }
  };

  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshLoading(true);
    setRefreshError(undefined);
    setRefreshResult(undefined);
    try {
      setRefreshResult(await onRefresh());
    } catch (error) {
      setRefreshError(displayError(error));
    } finally {
      setRefreshLoading(false);
    }
  };

  const trigger = (
    <AccordionTrigger
      testID={`device-toggle-${device.key}`}
      className="min-h-11 flex-1"
      accessibilityLabel={`${device.displayName} details, ${profileStatus}, ${rssiLabel}`}
      accessibilityHint={
        expanded ? "Collapse device details" : "Expand device details"
      }
      accessibilityState={{ expanded }}
    >
      <VStack className="flex-1" style={{ gap: eight2FiveSpacing.xs }}>
        <Text
          size="lg"
          style={{
            color: device.available ? theme.text : theme.textMuted,
            fontFamily: eight2FiveFonts.styleSemibold,
          }}
        >
          {device.displayName}
        </Text>
        <Text
          selectable
          size="sm"
          style={{
            color: theme.textMuted,
          }}
        >
          {device.canonicalIdentifier}
        </Text>
        {device.status !== "assigned-matching" || !device.available ? (
          <Text
            testID={`device-profile-status-${device.id}`}
            selectable
            size="sm"
            style={{
              color:
                device.status === "pan-conflict"
                  ? theme.danger
                  : theme.textMuted,
            }}
          >
            {profileStatus}
          </Text>
        ) : null}
      </VStack>
      <HStack
        testID={device.available ? undefined : `device-offline-${device.id}`}
        accessible
        accessibilityRole="image"
        accessibilityLabel={device.available ? rssiLabel : "Bluetooth offline"}
      >
        <Icon
          as={device.available ? RssiIcon : BluetoothOff}
          size="lg"
          style={{
            color:
              !device.available || rssiMuted ? theme.textMuted : theme.icon,
          }}
        />
      </HStack>
    </AccordionTrigger>
  );

  return (
    <Accordion
      type="multiple"
      value={expanded ? [device.key] : []}
      onValueChange={(values) => onExpandedChange(values.includes(device.key))}
      isCollapsible
    >
      <AccordionItem value={device.key}>
        <AccordionHeader className="m-0 py-0">
          <HStack
            className="w-full items-center"
            style={{ paddingVertical: eight2FiveSpacing.sm }}
          >
            {trigger}
            <Button
              testID={`device-settings-${device.key}`}
              size="icon"
              variant="ghost"
              isDisabled={settingsLoading}
              accessibilityLabel={`Settings for ${device.displayName}`}
              accessibilityHint="Opens hardware-derived device settings"
              accessibilityState={{
                disabled: settingsLoading,
              }}
              onPress={() => void openSettings()}
            >
              <ButtonIcon
                as={Settings}
                style={{
                  color: device.available ? theme.icon : theme.textMuted,
                }}
              />
            </Button>
            <AccordionIcon
              as={ChevronDown}
              style={{ color: device.available ? theme.icon : theme.textMuted }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </HStack>
        </AccordionHeader>
        <Divider style={{ backgroundColor: theme.border }} />
        <AccordionContent className="pb-0">
          {device.status === "pan-conflict" ? (
            <SettingInfoCard
              tone="error"
              testID={`device-profile-conflict-${device.id}`}
            >
              This hardware PAN ID matches more than one saved profile. Repair
              the duplicate PAN profiles before managing this device.
            </SettingInfoCard>
          ) : null}
          <DeviceDetails
            device={device}
            network={network}
            snapshot={snapshot}
            rssiLabel={rssiLabel}
          />
          {onRefresh ? (
            <Button
              testID={`refresh-device-${device.savedDevice!.id}`}
              size="sm"
              variant="ghost"
              className="self-start"
              isDisabled={refreshLoading}
              accessibilityLabel={`Refresh ${device.displayName} from device`}
              accessibilityState={{
                busy: refreshLoading,
                disabled: refreshLoading,
              }}
              onPress={() => void refresh()}
            >
              {refreshLoading ? (
                <ButtonSpinner color={theme.textMuted} />
              ) : (
                <ButtonIcon as={RefreshCw} style={{ color: theme.icon }} />
              )}
              <ButtonText style={{ color: theme.text }}>
                Refresh from device
              </ButtonText>
            </Button>
          ) : null}
          {refreshError ? (
            <InlineResult tone="error" message={refreshError} />
          ) : null}
          {refreshResult ? (
            <InlineResult
              tone="muted"
              message={`Refreshed ${formatTimestamp(
                refreshResult.inspectedAt,
              )}`}
            />
          ) : null}
          {settingsError ? (
            <InlineResult tone="error" message={settingsError} />
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export const networkDeviceRowPropsEqual = (
  previous: NetworkDeviceRowProps,
  next: NetworkDeviceRowProps,
) =>
  previous.device.key === next.device.key &&
  previous.device.id === next.device.id &&
  previous.device.displayName === next.device.displayName &&
  previous.device.canonicalIdentifier === next.device.canonicalIdentifier &&
  previous.device.status === next.device.status &&
  previous.device.cachedPanId === next.device.cachedPanId &&
  previous.device.available === next.device.available &&
  previous.device.savedDevice === next.device.savedDevice &&
  previous.device.discovery === next.device.discovery &&
  previous.network === next.network &&
  previous.snapshot === next.snapshot &&
  previous.expanded === next.expanded &&
  Boolean(previous.onRefresh) === Boolean(next.onRefresh);

export const MemoizedNetworkDeviceRow = React.memo(
  NetworkDeviceRow,
  networkDeviceRowPropsEqual,
);

function profileStatusLabel(device: DisplayDevice): string {
  const offline = device.available ? "" : "Offline · cached hardware state · ";
  if (device.status === "pan-conflict")
    return `${offline}Profile conflict for ${formatPanId(device.cachedPanId!)}`;
  if (device.status === "pan-unverified")
    return `${offline}Hardware PAN not verified`;
  if (device.status === "unassigned" && device.cachedPanId !== undefined)
    return `${offline}Unassigned · no profile matches ${formatPanId(device.cachedPanId)}`;
  if (!device.available) return "Offline · cached hardware state";
  return "Hardware PAN matches saved profile";
}

function DeviceDetails({
  device,
  network,
  snapshot,
  rssiLabel,
}: {
  device: DisplayDevice;
  network?: ManagedNetwork;
  snapshot?: DeviceConfigurationSnapshot;
  rssiLabel: string;
}) {
  const config = device.savedDevice?.lastKnownConfig ?? snapshot?.config;
  const inspection = snapshot?.inspection;
  const lastSeen =
    device.discovery?.lastSeenAt ?? device.savedDevice?.lastSeenAt;
  const warnings = [
    ...(inspection?.warnings ?? []),
    ...(device.discovery?.reason ? [device.discovery.reason] : []),
  ];

  return (
    <VStack style={{ paddingVertical: eight2FiveSpacing.sm }}>
      <DetailSection title="Identity">
        <DetailRow
          label="Node ID"
          value={
            inspection?.deviceInfo?.nodeIdHex ?? device.savedDevice?.nodeIdHex
          }
        />
        <DetailRow label="Transport" value="BLE" />
        <DetailRow
          label="Transport ID"
          value={device.transportDeviceId || undefined}
        />
        <DetailRow
          label="Hardware label"
          value={
            inspection?.label ?? config?.label ?? device.savedDevice?.label
          }
        />
        <DetailRow label="Last seen" value={formatTimestamp(lastSeen)} />
        <DetailRow label="RSSI" value={rssiLabel} />
      </DetailSection>

      <DetailSection title="Configuration">
        <DetailRow
          label="Saved profile"
          value={network ? getNetworkDisplayName(network) : "Unassigned"}
        />
        <DetailRow
          label="Last-read PAN"
          value={
            config?.panId === undefined ? undefined : formatPanId(config.panId)
          }
        />
        <DetailRow
          label="Role"
          value={config?.role ?? device.savedDevice?.role}
        />
        <DetailRow label="UWB" value={config?.uwbMode} />
        <DetailRow label="LED" value={formatBoolean(config?.ledEnabled)} />
        <DetailRow
          label="Initiator"
          value={
            config?.role === "anchor"
              ? formatBoolean(config.initiatorEnabled)
              : undefined
          }
        />
        <DetailRow
          label="Firmware selection"
          value={
            (inspection?.operationMode.selectedFirmware ??
              config?.selectedFirmware) === undefined
              ? undefined
              : `Slot ${
                  inspection?.operationMode.selectedFirmware ??
                  config?.selectedFirmware
                }`
          }
        />
        <DetailRow
          label="Firmware update"
          value={formatBoolean(config?.firmwareUpdateEnabled)}
        />
        <TagModeRows config={config} />
        <DetailRow
          label="Anchor saved position"
          value={formatAnchorPosition(
            config,
            network?.settings.mapUnits ?? "metric",
          )}
        />
      </DetailSection>

      <DetailSection title="Status" last>
        <DetailRow
          label="Availability"
          value={device.available ? "Available" : "Not detected"}
        />
        <DetailRow label="Connection" value="Disconnected · cached details" />
        <DetailRow
          label="Snapshot"
          value={formatTimestamp(
            inspection?.inspectedAt ?? snapshot?.capturedAt,
          )}
        />
        <DetailRow
          label="PAN status"
          value={formatPanStatus(network, config)}
        />
        <DetailRow
          label="Warnings"
          value={warnings.length ? warnings.join(" · ") : "—"}
        />
      </DetailSection>
    </VStack>
  );
}

function TagModeRows({ config }: { config: ManagedDeviceConfig | undefined }) {
  const tag = config?.role === "tag" ? config : undefined;
  return (
    <>
      <DetailRow
        label="Location engine"
        value={formatBoolean(tag?.locationEngineEnabled)}
      />
      <DetailRow
        label="Low power"
        value={formatBoolean(tag?.lowPowerModeEnabled)}
      />
      <DetailRow
        label="Stationary detection"
        value={formatBoolean(tag?.stationaryDetectionEnabled)}
      />
      <DetailRow label="Location data mode" value={tag?.locationDataMode} />
      <DetailRow
        label="Moving update"
        value={formatMilliseconds(tag?.movingUpdateRateMs)}
      />
      <DetailRow
        label="Stationary update"
        value={formatMilliseconds(tag?.stationaryUpdateRateMs)}
      />
    </>
  );
}

function DetailSection({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: eight2FiveSpacing.xs }}>
      <Text
        size="sm"
        style={{
          color: theme.text,
          fontFamily: eight2FiveFonts.styleSemibold,
          paddingTop: eight2FiveSpacing.sm,
        }}
      >
        {title}
      </Text>
      {children}
      {!last ? (
        <Divider
          style={{
            backgroundColor: theme.border,
            marginTop: eight2FiveSpacing.sm,
          }}
        />
      ) : null}
    </VStack>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | undefined;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      className="min-h-7 items-start justify-between"
      style={{ gap: eight2FiveSpacing.md }}
    >
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text
        selectable
        size="sm"
        className="shrink text-right"
        style={{
          color: theme.text,
          fontFamily: eight2FiveFonts.utilitySemibold,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value ?? "Unavailable"}
      </Text>
    </HStack>
  );
}

function InlineResult({
  tone,
  message,
}: {
  tone: "error" | "muted";
  message: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Text
      selectable
      size="sm"
      style={{
        color: tone === "error" ? theme.danger : theme.textMuted,
        paddingBottom: eight2FiveSpacing.sm,
      }}
    >
      {message}
    </Text>
  );
}

function formatBoolean(value: boolean | undefined): string | undefined {
  return value === undefined ? undefined : value ? "On" : "Off";
}

function formatMilliseconds(value: number | undefined): string | undefined {
  return value === undefined ? undefined : `${value} ms`;
}

function formatAnchorPosition(
  config: ManagedDeviceConfig | undefined,
  units: ManagedNetwork["settings"]["mapUnits"],
): string | undefined {
  if (config?.role !== "anchor" || !config.position) return undefined;
  const { xMeters, yMeters, zMeters, quality } = config.position;
  return `${formatMapDistance(xMeters, units)}, ${formatMapDistance(
    yMeters,
    units,
  )}, ${formatMapDistance(zMeters, units)} · quality ${quality}`;
}

function formatPanStatus(
  network: ManagedNetwork | undefined,
  config: ManagedDeviceConfig | undefined,
): string {
  if (!network) return "Unassigned";
  if (config?.panId === undefined) return "Unavailable to verify";
  if (config.panId === network.panId) return "Matches saved profile";
  return `Mismatch · ${formatPanId(config.panId)} read, ${formatPanId(
    network.panId,
  )} saved`;
}

function formatTimestamp(timestamp: number | undefined): string {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return "—";
  return new Date(timestamp).toLocaleString();
}
