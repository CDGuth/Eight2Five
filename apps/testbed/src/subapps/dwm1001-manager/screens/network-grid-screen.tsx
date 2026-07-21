import { useLocalSearchParams } from "expo-router";
import { ManagerMapScreen } from "./manager-map-screen";

export function NetworkGridScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  return <ManagerMapScreen initialNetworkId={networkId} />;
}
