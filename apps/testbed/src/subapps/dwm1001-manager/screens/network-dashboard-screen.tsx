import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import { useManagedNetwork } from "../manager-context";
import { ManagedDeviceRow } from "../components/managed-device-row";
import {
  KeyValue,
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";

export function NetworkDashboardScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const router = useRouter();
  const { network, devices } = useManagedNetwork(networkId);
  const [renderedAt] = React.useState(() => Date.now());

  if (!network) {
    return (
      <ManagerScreen>
        <StatePanel
          state="error"
          message="This saved network profile was not found."
        />
      </ManagerScreen>
    );
  }

  const offline = (device: ManagedDevice) =>
    !device.lastSeenAt ||
    renderedAt - device.lastSeenAt > network.settings.staleDeviceTimeoutMs;
  const sections = [
    {
      title: "Anchors",
      devices: devices.filter(
        (device) => device.role === "anchor" && !offline(device),
      ),
    },
    {
      title: "Tags",
      devices: devices.filter(
        (device) => device.role === "tag" && !offline(device),
      ),
    },
    {
      title: "Pending configuration",
      devices: devices.filter((device) => !device.role && !offline(device)),
    },
    { title: "Offline", devices: devices.filter(offline) },
  ];

  return (
    <ManagerScreen>
      <SectionCard title={network.name} description={network.notes}>
        <KeyValue
          label="PAN"
          value={`0x${network.panId
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")}`}
        />
        <KeyValue label="Devices" value={devices.length} />
        <KeyValue
          label="Health"
          value={devices.some(offline) ? "Attention needed" : "Healthy"}
        />
      </SectionCard>

      <SectionCard title="Network actions">
        <VStack space="sm">
          <ManagerButton
            label="Add devices"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/discovery" as never)
            }
          />
          <ManagerButton
            label="Grid (coming later)"
            variant="outline"
            isDisabled
          />
          <ManagerButton
            label="Batch configure (coming later)"
            variant="outline"
            isDisabled
          />
          <ManagerButton
            label="All devices"
            variant="ghost"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/devices` as never,
              )
            }
          />
          <ManagerButton
            label="Settings, export & delete"
            variant="ghost"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/settings` as never,
              )
            }
          />
        </VStack>
      </SectionCard>

      {sections.map((section) => (
        <SectionCard
          key={section.title}
          title={`${section.title} (${section.devices.length})`}
        >
          {section.devices.length ? (
            <VStack space="sm">
              {section.devices.map((device) => (
                <ManagedDeviceRow
                  key={device.id}
                  device={device}
                  offline={offline(device)}
                  onPress={() =>
                    router.push(
                      `/(subapps)/dwm1001-manager/devices/${device.id}` as never,
                    )
                  }
                />
              ))}
            </VStack>
          ) : (
            <Text selectable className="text-sm text-gray-600">
              No devices in this section.
            </Text>
          )}
        </SectionCard>
      ))}
    </ManagerScreen>
  );
}
