import { useLocalSearchParams } from "expo-router";

import { AnchorEditorScreen } from "../../../../src/features/settings/anchor-editor-screen";

export default function AnchorRoute() {
  const { anchorId } = useLocalSearchParams<{ anchorId: string }>();

  return <AnchorEditorScreen anchorId={anchorId ?? ""} />;
}
