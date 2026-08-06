import { useLocalSearchParams } from "expo-router";

import { NetworkDetailScreen } from "../../../../src/features/settings/network-detail-screen";

export default function NetworkDetailRoute() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();

  return <NetworkDetailScreen networkId={networkId ?? ""} />;
}
