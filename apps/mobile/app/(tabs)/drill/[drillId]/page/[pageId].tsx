import { useLocalSearchParams } from "expo-router";

import { PageEditorScreen } from "../../../../../src/features/drill/page-editor-screen";
import { normalizePagePlacement } from "../../../../../src/features/drill/page-management";

export default function DrillPageRoute() {
  const { drillId, pageId, placement, relativePageId } = useLocalSearchParams<{
    drillId: string;
    pageId: string;
    placement?: "append" | "before" | "after";
    relativePageId?: string;
  }>();
  return (
    <PageEditorScreen
      drillId={drillId}
      pageId={pageId}
      placement={normalizePagePlacement(placement)}
      relativePageId={relativePageId}
    />
  );
}
