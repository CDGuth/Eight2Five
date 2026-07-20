import React from "react";
import { useRouter } from "expo-router";
import { Badge, BadgeText } from "@eight2five/ui/components/badge";
import { Card } from "@eight2five/ui/components/card";
import { HStack } from "@eight2five/ui/components/hstack";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import { useManagedNetworks, useManagerReadiness } from "../manager-context";
import { formatRelativeTime } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  SetupStep,
  StatePanel,
} from "../components/manager-ui";

export function DashboardScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const readiness = useManagerReadiness();
  const { networks, devices } = useManagedNetworks();
  const [renderedAt] = React.useState(() => Date.now());

  return (
    <ManagerScreen>
      <SectionCard
        title="Set up a DWM1001 network"
        description="Follow the MDEK1001 setup order."
        testID="manager-readiness"
        tone="accent"
      >
        <VStack style={{ gap: eight2FiveSpacing.md }}>
          <SetupStep
            number={1}
            title="Prepare the hardware"
            detail="Place four powered anchors high, at the same height, in a rectangle. Power at least one tag."
          />
          <SetupStep
            number={2}
            title="Discover and create a network"
            detail="Scan, select the units, and name the network."
          />
          <SetupStep
            number={3}
            title="Configure anchors and tags"
            detail="Set UWB to Active and choose exactly one initiator anchor."
          />
          <SetupStep
            number={4}
            title="Position the anchors"
            detail="Measure and enter X, Y, and Z coordinates."
          />
          <SetupStep
            number={5}
            title="Track tags"
            detail="Open Position & Track to view live locations."
          />
        </VStack>
        {readiness.initialization === "initializing" ? (
          <StatePanel state="loading" message="Preparing network manager…" />
        ) : null}
        {readiness.error ? (
          <StatePanel
            state="error"
            message={readiness.error}
            onRetry={readiness.retry}
          />
        ) : null}
        <ManagerButton
          label="Start device discovery"
          testID="discover-devices"
          isDisabled={readiness.initialization !== "ready"}
          onPress={() =>
            router.push("/(subapps)/dwm1001-manager/discovery" as never)
          }
        />
      </SectionCard>

      <SectionCard title="Networks">
        {networks.length === 0 ? (
          <VStack style={{ gap: eight2FiveSpacing.sm }}>
            <Text
              style={{
                color: theme.text,
                fontFamily: eight2FiveFonts.styleSemibold,
              }}
            >
              No saved networks
            </Text>
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              Start discovery to create your first network.
            </Text>
          </VStack>
        ) : (
          <VStack style={{ gap: eight2FiveSpacing.sm }}>
            {networks.map((network) => {
              const members = devices.filter(
                (device) => device.networkId === network.id,
              );
              const offline = members.filter(
                (device) =>
                  !device.lastSeenAt ||
                  renderedAt - device.lastSeenAt >
                    network.settings.staleDeviceTimeoutMs,
              ).length;
              return (
                <Pressable
                  key={network.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${network.name}`}
                  onPress={() =>
                    router.push(
                      `/(subapps)/dwm1001-manager/networks/${network.id}` as never,
                    )
                  }
                >
                  <Card
                    className="p-0"
                    style={{
                      borderWidth: 0,
                      borderRadius: eight2FiveRadii.sm,
                      backgroundColor: theme.surface,
                      padding: 14,
                    }}
                  >
                    <VStack style={{ gap: 4 }}>
                      <HStack
                        className="items-center justify-between"
                        style={{ gap: 8 }}
                      >
                        <Text
                          className="flex-1"
                          style={{
                            color: theme.text,
                            fontFamily: eight2FiveFonts.styleSemibold,
                          }}
                        >
                          {network.name}
                        </Text>
                        <Badge variant={offline ? "outline" : "secondary"}>
                          <BadgeText>
                            {offline ? `${offline} offline` : "Ready"}
                          </BadgeText>
                        </Badge>
                      </HStack>
                      <Text
                        selectable
                        size="sm"
                        style={{ color: theme.textMuted }}
                      >
                        {members.length} devices · PAN 0x
                        {network.panId
                          .toString(16)
                          .toUpperCase()
                          .padStart(4, "0")}
                      </Text>
                      <Text
                        selectable
                        size="sm"
                        style={{ color: theme.textSubtle }}
                      >
                        Opened{" "}
                        {formatRelativeTime(network.lastOpenedAt, renderedAt)}
                      </Text>
                    </VStack>
                  </Card>
                </Pressable>
              );
            })}
          </VStack>
        )}
      </SectionCard>

      <SectionCard title="More" tone="quiet">
        <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
          <ManagerButton
            label="Import network"
            variant="outline"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/import" as never)
            }
          />
          <ManagerButton
            label="Settings"
            variant="ghost"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/settings" as never)
            }
          />
        </HStack>
      </SectionCard>
    </ManagerScreen>
  );
}
