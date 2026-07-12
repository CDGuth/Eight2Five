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
        description={`${devices.length} locally associated device(s).`}
      >
        {devices.map((device) => (
          <ManagedDeviceRow
            key={device.id}
            device={device}
            onPress={() =>
              router.push(
                `/(subapps)/dwm1001-manager/devices/${device.id}` as never,
              )
            }
          />
        ))}
        {!devices.length ? (
          <StatePanel
            state="info"
            message="No devices are associated with this profile."
          />
        ) : null}
      </SectionCard>
    </ManagerScreen>
  );
}
