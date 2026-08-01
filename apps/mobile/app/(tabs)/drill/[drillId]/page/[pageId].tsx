import { useLocalSearchParams } from "expo-router";

import { PageEditorScreen } from "../../../../../src/features/drill/page-editor-screen";

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
      placement={placement}
      relativePageId={relativePageId}
    />
  );
}
