import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useManagedNetwork, useManagedNetworks } from "../manager-context";
import { useRepositoryNetworkActions } from "../actions/repository-network-actions";
import { ManagerScreen, StatePanel } from "../components/manager-ui";
import {
  AvailabilitySettingsSection,
  CoordinateSystemSettingsSection,
  DestructiveSettingsSection,
  DeviceDefaultsSettingsSection,
  ExportSettingsSection,
  IdentitySettingsSection,
} from "../components/network-settings-sections";
import { useNetworkSettingsDraft } from "../hooks/use-network-settings-draft";

export function NetworkSettingsScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const router = useRouter();
  const networks = useManagedNetworks();
  const repositoryActions = useRepositoryNetworkActions();
  const { network } = useManagedNetwork(networkId);
  const onDeleted = React.useCallback(
    () => router.replace("/(tabs)/networks-devices" as never),
    [router],
  );
  const draft = useNetworkSettingsDraft(
    network,
    networks,
    repositoryActions,
    onDeleted,
  );
  const defaults = React.useMemo(
    () => ({
      locationEngineEnabled: draft.settings.locationEngineEnabled,
      lowPowerModeEnabled: draft.settings.lowPowerModeEnabled,
      stationaryDetectionEnabled: draft.settings.stationaryDetectionEnabled,
      locationDataMode: draft.settings.locationDataMode,
      movingUpdateRateMs: draft.settings.movingUpdateRateMs,
      stationaryUpdateRateMs: draft.settings.stationaryUpdateRateMs,
      positionLogRetentionDays: draft.settings.positionLogRetentionDays,
      positionLogMaxSamples: draft.settings.positionLogMaxSamples,
    }),
    [
      draft.settings.locationEngineEnabled,
      draft.settings.locationDataMode,
      draft.settings.lowPowerModeEnabled,
      draft.settings.movingUpdateRateMs,
      draft.settings.positionLogMaxSamples,
      draft.settings.positionLogRetentionDays,
      draft.settings.stationaryDetectionEnabled,
      draft.settings.stationaryUpdateRateMs,
    ],
  );

  if (!network) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );
  }

  return (
    <ManagerScreen>
      <IdentitySettingsSection
        name={draft.name}
        notes={draft.notes}
        panId={network.panId}
        message={draft.message}
        error={draft.error}
        onNameChange={draft.setName}
        onNotesChange={draft.setNotes}
        onSave={draft.save}
      />
      <CoordinateSystemSettingsSection
        mapUnits={draft.settings.mapUnits}
        mapAreaMode={draft.settings.mapAreaMode}
        minX={draft.settings.minXMeters}
        maxX={draft.settings.maxXMeters}
        minY={draft.settings.minYMeters}
        maxY={draft.settings.maxYMeters}
        minZ={draft.settings.minZMeters}
        maxZ={draft.settings.maxZMeters}
        anchorHeight={draft.settings.defaultAnchorHeightMeters}
        onMapUnitsChange={draft.setMapUnits}
        setField={draft.setField}
      />
      <AvailabilitySettingsSection
        staleTimeout={draft.settings.staleDeviceTimeoutSeconds}
        autoConnect={draft.settings.autoConnect}
        setField={draft.setField}
      />
      <DeviceDefaultsSettingsSection
        form={defaults}
        setField={draft.setField}
      />
      <ExportSettingsSection
        format={draft.exportFormat}
        text={draft.exportText}
        onFormatChange={draft.setExportFormat}
        onExport={draft.exportProfile}
      />
      <DestructiveSettingsSection
        networkName={network.name}
        confirming={draft.confirmingDelete}
        onConfirmingChange={draft.setConfirmingDelete}
        onDelete={draft.deleteProfile}
      />
    </ManagerScreen>
  );
}
