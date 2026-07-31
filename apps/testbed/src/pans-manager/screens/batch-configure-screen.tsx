import React from "react";
import { useLocalSearchParams } from "expo-router";
import {
  getDeviceDisplayName,
  type ManagedDevice,
  type ManagedDeviceConfig,
  type PansBatchOperationItem,
  type PansConfigurationResult,
} from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import { BatchResults } from "../components/batch-results";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  SelectField,
  StatePanel,
  SwitchField,
} from "../components/manager-ui";
import { useManagedNetwork, useManagedNetworks } from "../manager-context";
import { useRepositoryNetworkActions } from "../actions/repository-network-actions";
import { useDeviceConfigurationActions } from "../actions/device-configuration-actions";
import { usePositionLogActions } from "../actions/position-log-actions";
import {
  createManagerId,
  defaultConfigForDevice,
  displayError,
} from "../manager-utils";

type RoleAction = "keep" | "anchor" | "tag";

export function BatchConfigureScreen() {
  const params = useLocalSearchParams<{
    networkId: string;
    migration?: string;
    oldPanId?: string;
    newPanId?: string;
    name?: string;
    notes?: string;
  }>();
  const theme = useEight2FiveTheme();
  const networks = useManagedNetworks();
  const { saveNetworkLocalDetails } = useRepositoryNetworkActions();
  const { migrateNetworkPan, assignToNetwork, configure } =
    useDeviceConfigurationActions();
  const { runBatch } = usePositionLogActions();
  const { network, devices } = useManagedNetwork(params.networkId);
  const migration = params.migration === "1";
  const [selected, setSelected] = React.useState(
    () => new Set(migration ? devices.map((device) => device.id) : []),
  );
  const [assignPan, setAssignPan] = React.useState(migration);
  const [roleAction, setRoleAction] = React.useState<RoleAction>("keep");
  const [uwbMode, setUwbMode] = React.useState("keep");
  const [led, setLed] = React.useState("keep");
  const [initiatorId, setInitiatorId] = React.useState("none");
  const [reviewing, setReviewing] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [items, setItems] = React.useState<PansBatchOperationItem[]>([]);
  const [error, setError] = React.useState<string>();
  const [message, setMessage] = React.useState<string>();
  const batchId = React.useRef(
    createManagerId(migration ? "pan-migration" : "batch"),
  );
  const migrationSelectionInitialized = React.useRef(false);
  const controller = React.useRef<AbortController | undefined>(undefined);

  React.useEffect(() => {
    if (
      migration &&
      devices.length > 0 &&
      !migrationSelectionInitialized.current
    ) {
      migrationSelectionInitialized.current = true;
      setSelected(new Set(devices.map((device) => device.id)));
    }
  }, [devices, migration]);

  if (!network) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );
  }

  const selectedDevices = devices.filter((device) => selected.has(device.id));
  const targetPanId = migration ? Number(params.newPanId) : network.panId;
  const intendedName = params.name?.trim() || network.name;
  const migrationParametersValid =
    !migration ||
    (Number.isInteger(targetPanId) &&
      targetPanId >= 0 &&
      targetPanId <= 0xffff &&
      Number(params.oldPanId) === network.panId &&
      targetPanId !== network.panId &&
      !networks.some(
        (item) =>
          item.id !== network.id &&
          item.name.trim().toLowerCase() === intendedName.toLowerCase(),
      ));
  const execute = async () => {
    if (!migrationParametersValid) {
      setError(
        "This migration is stale or invalid. Return to network settings and review it again.",
      );
      return;
    }
    setRunning(true);
    setError(undefined);
    setMessage(undefined);
    controller.current = new AbortController();
    setItems(
      selectedDevices.map((device, index) => ({
        batchId: batchId.current,
        deviceId: device.id,
        index,
        status: "pending",
        attempts: 0,
      })),
    );
    try {
      if (migration) {
        await saveNetworkLocalDetails({
          networkId: network.id,
          name: intendedName,
          notes: params.notes,
        });
        const migrationResult = await migrateNetworkPan({
          networkId: network.id,
          targetPanId,
          operationId: batchId.current,
          signal: controller.current.signal,
          onItemChange: (changed) =>
            setItems((current) => {
              const next = current.filter(
                (item) => item.deviceId !== changed.deviceId,
              );
              next.push(changed);
              return next.sort((left, right) => left.index - right.index);
            }),
        });
        setItems(migrationResult.items ?? []);
        if (migrationResult.error) setError(migrationResult.error.message);
        setMessage(`PAN migration ${migrationResult.outcome}.`);
        return;
      }
      const result = await runBatch<PansConfigurationResult>({
        id: batchId.current,
        type: "batch-configure",
        deviceIds: selectedDevices.map((device) => device.id),
        signal: controller.current.signal,
        onItemChange: (changed) =>
          setItems((current) => {
            const next = current.filter(
              (item) => item.deviceId !== changed.deviceId,
            );
            next.push(changed);
            return next.sort((left, right) => left.index - right.index);
          }),
        metadata: {
          networkId: network.id,
          ...(assignPan ? { panId: targetPanId } : {}),
          roleAction,
          uwbMode,
          led,
          initiatorId,
        },
        operation: async (deviceId) => {
          if (assignPan) {
            const assignment = await assignToNetwork({
              deviceId,
              targetNetworkId: network.id,
            });
            if (assignment.outcome !== "assigned") {
              throw new Error(
                assignment.error?.message ??
                  "Network profile assignment did not verify the PAN ID.",
              );
            }
          }
          const device = devices.find((item) => item.id === deviceId)!;
          const config = buildBatchConfiguration(device, {
            assignPan: false,
            panId: targetPanId,
            roleAction,
            uwbMode,
            led,
            initiatorId,
          });
          const configured = await configure(deviceId, config);
          if (
            configured.outcome === "failure" ||
            configured.writes.some((write) => write.status !== "verified")
          )
            throw new Error(
              configured.error?.message ??
                "Configuration readback did not verify.",
            );
          return configured;
        },
      });
      setItems(result.items);
      const allSucceeded =
        result.items.length > 0 &&
        result.items.every((item) => item.status === "succeeded");
      if (allSucceeded) {
        setMessage(
          "Batch completed. Successful devices were retained and verified.",
        );
      } else if (result.operation.status === "cancelled") {
        setMessage(
          "Cancelled between devices. Completed hardware changes were retained.",
        );
      } else {
        setMessage(
          "Batch finished with failures. Retry reuses successes and runs failed items again.",
        );
      }
    } catch (batchError) {
      setError(displayError(batchError));
    } finally {
      setRunning(false);
    }
  };

  const failed = items.some(
    (item) => item.status === "failed" || item.status === "skipped",
  );
  const planLocked = items.length > 0;
  const labels = Object.fromEntries(
    devices.map((device) => [device.id, getDeviceDisplayName(device)]),
  );

  return (
    <ManagerScreen>
      <SectionCard
        title={
          migration
            ? "Review hardware PAN migration"
            : "Batch configuration plan"
        }
      >
        {devices.map((device) => (
          <SwitchField
            key={device.id}
            label={getDeviceDisplayName(device)}
            description={`${device.role ?? "unknown role"} · ${
              device.transportDeviceId
            }`}
            value={selected.has(device.id)}
            disabled={running || migration || planLocked}
            onChange={(enabled) =>
              setSelected((current) => {
                const next = new Set(current);
                if (enabled) next.add(device.id);
                else next.delete(device.id);
                return next;
              })
            }
          />
        ))}
        {migration && !migrationParametersValid ? (
          <StatePanel
            state="error"
            message="This migration is stale or invalid. Return to network settings and review it again."
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Operations">
        <SwitchField
          label={`Assign PAN ${targetPanId}`}
          value={assignPan}
          onChange={setAssignPan}
          disabled={migration || running || planLocked}
        />
        <SelectField<RoleAction>
          label="Role configuration"
          value={roleAction}
          onChange={(value) => {
            if (!planLocked) setRoleAction(value);
          }}
          choices={[
            { label: "Keep current/default", value: "keep" },
            { label: "Configure as anchors", value: "anchor" },
            { label: "Configure as tags", value: "tag" },
          ]}
        />
        <SelectField
          label="UWB mode"
          value={uwbMode}
          onChange={(value) => {
            if (!planLocked) setUwbMode(value);
          }}
          choices={[
            { label: "Keep current/default", value: "keep" },
            { label: "Active", value: "active" },
            { label: "Passive", value: "passive" },
            { label: "Off", value: "off" },
          ]}
        />
        <SelectField
          label="LED"
          value={led}
          onChange={(value) => {
            if (!planLocked) setLed(value);
          }}
          choices={[
            { label: "Keep current/default", value: "keep" },
            { label: "Enabled", value: "on" },
            { label: "Disabled", value: "off" },
          ]}
        />
        <SelectField
          label="Initiator"
          value={initiatorId}
          onChange={(value) => {
            if (!planLocked) setInitiatorId(value);
          }}
          choices={[
            { label: "None", value: "none" },
            ...selectedDevices
              .filter(
                (device) => roleAction === "anchor" || device.role === "anchor",
              )
              .map((device) => ({
                label: getDeviceDisplayName(device),
                value: device.id,
              })),
          ]}
        />
        {!reviewing ? (
          <ManagerButton
            label="Review plan"
            isDisabled={!selectedDevices.length || !migrationParametersValid}
            onPress={() => setReviewing(true)}
          />
        ) : (
          <VStack space="sm">
            <Text selectable size="sm" style={{ color: theme.text }}>
              {selectedDevices.length} device(s), sequential verified writes.{" "}
              {migration
                ? `Old PAN ${params.oldPanId}; new PAN ${targetPanId}. Local PAN changes only after all succeed.`
                : "No rollback of successful items."}
            </Text>
            <ManagerButton
              label={failed ? "Retry failed items" : "Confirm and execute"}
              loading={running}
              onPress={() => void execute()}
            />
            {running ? (
              <ManagerButton
                label="Cancel after current device"
                variant="outline"
                onPress={() => controller.current?.abort()}
              />
            ) : null}
          </VStack>
        )}
      </SectionCard>

      {items.length ? (
        <SectionCard title="Per-device results">
          <BatchResults items={items} labels={labels} />
        </SectionCard>
      ) : null}
      {message ? <StatePanel state="info" message={message} /> : null}
      {error ? <StatePanel state="error" message={error} /> : null}
    </ManagerScreen>
  );
}

export function buildBatchConfiguration(
  device: ManagedDevice,
  plan: {
    assignPan: boolean;
    panId: number;
    roleAction: RoleAction;
    uwbMode: string;
    led: string;
    initiatorId: string;
  },
): ManagedDeviceConfig {
  const current = defaultConfigForDevice(device);
  const common = {
    ...(current.label ? { label: current.label } : {}),
    ...(plan.assignPan
      ? { panId: plan.panId }
      : current.panId !== undefined
        ? { panId: current.panId }
        : {}),
    uwbMode: (plan.uwbMode === "keep"
      ? current.uwbMode
      : plan.uwbMode) as ManagedDeviceConfig["uwbMode"],
    ledEnabled: plan.led === "keep" ? current.ledEnabled : plan.led === "on",
    firmwareUpdateEnabled: current.firmwareUpdateEnabled,
  };
  const role = plan.roleAction === "keep" ? current.role : plan.roleAction;
  if (role === "anchor") {
    return {
      ...common,
      role: "anchor",
      initiatorEnabled: plan.initiatorId === device.id,
      ...(current.role === "anchor" && current.position
        ? { position: current.position }
        : {}),
    };
  }
  return {
    ...common,
    role: "tag",
    locationEngineEnabled:
      current.role === "tag" ? current.locationEngineEnabled : true,
    lowPowerModeEnabled:
      current.role === "tag" ? current.lowPowerModeEnabled : false,
    stationaryDetectionEnabled:
      current.role === "tag" ? current.stationaryDetectionEnabled : true,
    locationDataMode: current.role === "tag" ? current.locationDataMode : 0,
  };
}
