import React from "react";
import { useLocalSearchParams } from "expo-router";
import type { PansInspectionResult } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/text";

import { useManagedDevice, usePansManager } from "../manager-context";
import { bytesToHex, displayError } from "../manager-utils";
import {
  KeyValue,
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";

export function DeviceDiagnosticsScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const manager = usePansManager();
  const device = useManagedDevice(deviceId);
  const advertisement = manager.discoveries.find(
    (item) => item.transportDeviceId === device?.transportDeviceId,
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
    } catch (refreshError) {
      setError(displayError(refreshError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Advertisement"
        description="Latest deduplicated discovery snapshot; this screen does not start scanning."
      >
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
          label="Raw presence hex"
          value={bytesToHex(advertisement?.presence?.raw)}
        />
        {advertisement?.reason ? (
          <StatePanel state="info" message={advertisement.reason} />
        ) : null}
      </SectionCard>

      <SectionCard
        title="Connected diagnostics"
        description="Refresh explicitly connects and reads supported GATT characteristics."
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
        {inspection ? (
          <>
            <KeyValue
              label="Operation mode raw"
              value={bytesToHex(inspection.operationMode.raw)}
            />
            <KeyValue
              label="Operation mode parsed"
              value={JSON.stringify(inspection.operationMode)}
            />
            <KeyValue
              label="Device info"
              value={
                inspection.deviceInfo
                  ? JSON.stringify(inspection.deviceInfo)
                  : "Unavailable"
              }
            />
            <KeyValue
              label="Location mode"
              value={inspection.locationDataMode ?? "Unavailable"}
            />
            <KeyValue
              label="Update rate"
              value={
                inspection.updateRate
                  ? JSON.stringify(inspection.updateRate)
                  : "Unavailable"
              }
            />
            {inspection.warnings.map((warning) => (
              <StatePanel key={warning} state="info" message={warning} />
            ))}
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="Raw export">
        <Text
          selectable
          className="rounded-lg bg-gray-100 p-3 font-mono text-xs text-black"
        >
          {JSON.stringify({ advertisement, inspection }, null, 2)}
        </Text>
        <ManagerButton label="Copy unavailable" variant="outline" isDisabled />
        <ManagerButton
          label="File export unavailable"
          variant="outline"
          isDisabled
        />
        <Text selectable className="text-sm text-gray-600">
          No app-safe clipboard or file adapter is declared for this manager UI.
        </Text>
      </SectionCard>
    </ManagerScreen>
  );
}
