import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import {
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";
import { useManagedDevice } from "../manager-context";

export function DeviceFirmwareScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const device = useManagedDevice(deviceId);
  return (
    <ManagerScreen>
      <StatePanel
        state="info"
        message="Firmware update is disabled in this release. This deep-linked page cannot select files, connect a transport, or execute an update."
      />
      <SectionCard
        title="Hardware qualification checklist"
        description={
          device
            ? `Device: ${device.nickname || device.label || device.id}`
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
            <Text key={item} selectable className="text-sm text-gray-700">
              • {item}
            </Text>
          ))}
        </VStack>
      </SectionCard>
    </ManagerScreen>
  );
}
