import { useLocalSearchParams } from "expo-router";

import { PageEditorScreen } from "../../../../../src/features/drill/page-editor-screen";

export default function DrillPageRoute() {
  const { drillId, pageId } = useLocalSearchParams<{
    drillId: string;
    pageId: string;
  }>();
  return <PageEditorScreen drillId={drillId} pageId={pageId} />;
}
