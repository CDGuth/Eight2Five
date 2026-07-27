import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useManagedNetwork } from "../manager-context";
import { ManagedDeviceRow } from "../components/managed-device-row";
import {
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";

export function NetworkDevicesScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const router = useRouter();
  const { network, devices } = useManagedNetwork(networkId);
  if (!network) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );
  }
  return (
    <ManagerScreen>
      <SectionCard
        title={`${network.name} devices`}
        description={`${devices.length} device(s) with a verified cached hardware PAN match.`}
      >
        {devices.map((device) => (
          <ManagedDeviceRow
            key={device.id}
            device={device}
            onPress={() => router.push(`/devices/${device.id}` as never)}
          />
        ))}
        {!devices.length ? (
          <StatePanel
            state="info"
            message="No cached hardware PAN IDs uniquely match this profile."
          />
        ) : null}
      </SectionCard>
    </ManagerScreen>
  );
}
