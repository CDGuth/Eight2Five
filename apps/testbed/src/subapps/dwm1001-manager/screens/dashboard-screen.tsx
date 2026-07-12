import React from "react";
import { useRouter } from "expo-router";
import { Badge, BadgeText } from "@eight2five/ui/badge";
import { Button, ButtonText } from "@eight2five/ui/button";
import { HStack } from "@eight2five/ui/hstack";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import { useManagedNetworks, useManagerReadiness } from "../manager-context";
import { formatRelativeTime } from "../manager-utils";
import {
  KeyValue,
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";

export function DashboardScreen() {
  const router = useRouter();
  const readiness = useManagerReadiness();
  const { networks, devices } = useManagedNetworks();
  const [renderedAt] = React.useState(() => Date.now());

  return (
    <ManagerScreen>
      <SectionCard
        title="Readiness"
        description="Discovery is always explicit. Opening this screen never asks for Bluetooth permission or starts a scan."
        testID="manager-readiness"
      >
        <KeyValue
          label="Native module"
          value={statusLabel(readiness.moduleStatus)}
        />
        <KeyValue
          label="Local storage"
          value={statusLabel(readiness.storageStatus)}
        />
        <KeyValue
          label="Bluetooth permission"
          value={readiness.permission?.bluetooth ?? "Not checked"}
        />
        {readiness.initialization === "initializing" ? (
          <StatePanel state="loading" message="Initializing manager storage…" />
        ) : null}
        {readiness.error ? (
          <StatePanel
            state="error"
            message={readiness.error}
            onRetry={readiness.retry}
          />
        ) : null}
        <StatePanel
          state="info"
          message="DWM1001 access requires a custom development build. Device firmware and its exposed PANS GATT characteristics must also be compatible."
        />
        <ManagerButton
          label="Discover devices"
          testID="discover-devices"
          isDisabled={readiness.initialization !== "ready"}
          onPress={() =>
            router.push("/(subapps)/dwm1001-manager/discovery" as never)
          }
        />
      </SectionCard>

      <SectionCard title="Saved network profiles">
        {networks.length === 0 ? (
          <VStack className="items-start gap-3 rounded-lg bg-gray-50 p-4">
            <Text className="font-medium text-black">No saved profiles</Text>
            <Text selectable className="text-sm text-gray-600">
              Create a local network profile, then explicitly add and configure
              nearby devices.
            </Text>
            <ManagerButton
              label="Create first network"
              variant="outline"
              onPress={() =>
                router.push("/(subapps)/dwm1001-manager/networks/new" as never)
              }
            />
          </VStack>
        ) : (
          <VStack space="md">
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
                <Button
                  key={network.id}
                  variant="outline"
                  className="min-h-20 h-auto justify-start p-4"
                  onPress={() =>
                    router.push(
                      `/(subapps)/dwm1001-manager/networks/${network.id}` as never,
                    )
                  }
                >
                  <VStack className="flex-1 items-start gap-1">
                    <HStack className="w-full items-center justify-between gap-2">
                      <ButtonText className="text-base">
                        {network.name}
                      </ButtonText>
                      <Badge variant={offline ? "outline" : "secondary"}>
                        <BadgeText>
                          {offline ? `${offline} offline` : "healthy"}
                        </BadgeText>
                      </Badge>
                    </HStack>
                    <ButtonText className="text-xs text-gray-600">
                      {members.length} devices · PAN 0x
                      {network.panId
                        .toString(16)
                        .toUpperCase()
                        .padStart(4, "0")}
                    </ButtonText>
                    <ButtonText className="text-xs text-gray-600">
                      Last opened{" "}
                      {formatRelativeTime(network.lastOpenedAt, renderedAt)}
                    </ButtonText>
                  </VStack>
                </Button>
              );
            })}
          </VStack>
        )}
      </SectionCard>

      <SectionCard title="Manager actions">
        <VStack space="sm">
          <ManagerButton
            label="Create network"
            variant="outline"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/networks/new" as never)
            }
          />
          <ManagerButton
            label="Import profile"
            variant="outline"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/import" as never)
            }
          />
          <ManagerButton
            label="Manager settings"
            variant="ghost"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/settings" as never)
            }
          />
        </VStack>
      </SectionCard>
    </ManagerScreen>
  );
}

function statusLabel(status: string): string {
  return status === "ready" ? "Ready" : status === "error" ? "Failed" : status;
}
