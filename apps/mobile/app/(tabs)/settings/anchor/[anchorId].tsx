import { useLocalSearchParams } from "expo-router";

import { PlaceholderScreen } from "../../../../src/features/placeholder-screen";

export default function AnchorRoute() {
  const { anchorId } = useLocalSearchParams<{ anchorId: string }>();

  return (
    <PlaceholderScreen
      title="Anchor"
      description={`Cached anchor ${anchorId ?? ""}`.trim()}
    />
  );
}
