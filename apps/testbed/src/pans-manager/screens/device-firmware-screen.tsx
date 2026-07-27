import React from "react";
import { useLocalSearchParams } from "expo-router";
import { getDeviceDisplayName } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import {
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";
import { useManagedDevice } from "../manager-context";

export function DeviceFirmwareScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const theme = useEight2FiveTheme();
  const device = useManagedDevice(deviceId);
  return (
    <ManagerScreen>
      <StatePanel
        state="info"
        message="Firmware update is disabled in this release."
      />
      <SectionCard
        title="Hardware qualification checklist"
        description={
          device
            ? `Device: ${getDeviceDisplayName(device)}`
            : "The requested managed device was not found."
        }
      >
        <VStack space="sm">
          {[
            "Validate DWM1001 hardware revision and bootloader compatibility.",
            "Verify signed/approved firmware provenance and checksums.",
            "Qualify interruption, low-battery, and recovery behavior on hardware.",
            "Review packet sizing, write pacing, and platform BLE behavior.",
            "Complete a separately reviewed transport and release safety plan.",
          ].map((item) => (
            <Text key={item} selectable size="sm" style={{ color: theme.text }}>
              • {item}
            </Text>
          ))}
        </VStack>
      </SectionCard>
    </ManagerScreen>
  );
}
