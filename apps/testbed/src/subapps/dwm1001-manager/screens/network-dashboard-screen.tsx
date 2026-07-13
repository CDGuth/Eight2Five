import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";
import { HStack } from "@eight2five/ui/hstack";
import { Text } from "@eight2five/ui/text";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/vstack";

import { useManagedNetwork, usePansManager } from "../manager-context";
import { ManagedDeviceRow } from "../components/managed-device-row";
import {
  KeyValue,
  ManagerButton,
  ManagerScreen,
  SectionCard,
  SetupStep,
  StatePanel,
} from "../components/manager-ui";

export function NetworkDashboardScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const manager = usePansManager();
  const { network, devices } = useManagedNetwork(networkId);
  const [renderedAt] = React.useState(() => Date.now());
  const openedNetworkId = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!network || openedNetworkId.current === network.id) return;
    openedNetworkId.current = network.id;
    void manager
      .saveNetwork({
        ...network,
        lastOpenedAt: Date.now(),
        updatedAt: network.updatedAt,
      })
      .catch(() => {
        openedNetworkId.current = undefined;
      });
  }, [manager, network]);

  if (!network) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );
  }

  const offline = (device: ManagedDevice) =>
    !device.lastSeenAt ||
    renderedAt - device.lastSeenAt > network.settings.staleDeviceTimeoutMs;
  const anchors = devices.filter((device) => device.role === "anchor");
  const tags = devices.filter((device) => device.role === "tag");
  const initiators = anchors.filter(
    (device) =>
      device.lastKnownConfig?.role === "anchor" &&
      device.lastKnownConfig.initiatorEnabled,
  );
  const positionedAnchors = anchors.filter(
    (device) =>
      device.lastKnownConfig?.role === "anchor" &&
      Boolean(device.lastKnownConfig.position),
  );
  const configured =
    anchors.length >= 4 && tags.length >= 1 && initiators.length === 1;
  const positioned =
    anchors.length > 0 && positionedAnchors.length === anchors.length;
  const sections = [
    { title: "Anchors", devices: anchors.filter((device) => !offline(device)) },
    { title: "Tags", devices: tags.filter((device) => !offline(device)) },
    {
      title: "Needs configuration",
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
        <KeyValue label="Anchors" value={anchors.length} />
        <KeyValue label="Tags" value={tags.length} />
      </SectionCard>

      <SectionCard title="Network setup" tone="accent">
        <VStack style={{ gap: eight2FiveSpacing.md }}>
          <SetupStep
            number={1}
            title="Add devices"
            detail={`${devices.length} devices in this network`}
            complete={devices.length > 0}
          />
          <SetupStep
            number={2}
            title="Configure anchors and tags"
            detail={`${anchors.length} anchors · ${tags.length} tags · ${initiators.length} initiator`}
            complete={configured}
          />
          <SetupStep
            number={3}
            title="Position anchors"
            detail={`${positionedAnchors.length} of ${anchors.length} anchors positioned`}
            complete={positioned}
          />
          <SetupStep
            number={4}
            title="Track tags"
            detail="Open the live grid after setup is complete."
          />
        </VStack>
        <VStack style={{ gap: eight2FiveSpacing.sm }}>
          <ManagerButton
            label="Add devices"
            variant="outline"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/discovery" as never)
            }
          />
          <ManagerButton
            label="Configure devices"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/devices` as never,
              )
            }
          />
          <ManagerButton
            label="Position & track"
            variant="outline"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/grid` as never,
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
            <VStack style={{ gap: eight2FiveSpacing.sm }}>
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
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              None
            </Text>
          )}
        </SectionCard>
      ))}

      <SectionCard title="Advanced tools" tone="quiet">
        <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
          <ManagerButton
            label="Batch configure"
            variant="outline"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/batch-configure` as never,
              )
            }
          />
          <ManagerButton
            label="Topology"
            variant="outline"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/topology` as never,
              )
            }
          />
          <ManagerButton
            label="Logs"
            variant="ghost"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/log` as never,
              )
            }
          />
          <ManagerButton
            label="Network settings"
            variant="ghost"
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/networks/${network.id}/settings` as never,
              )
            }
          />
        </HStack>
      </SectionCard>
    </ManagerScreen>
  );
}
