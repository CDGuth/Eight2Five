import { PlaceholderScreen } from "../placeholder-screen";
import { usePageEditorController } from "./use-page-editor-controller";

export function PageEditorScreen({
  drillId,
  pageId,
}: {
  drillId: string;
  pageId: string;
}) {
  const { terms } = usePageEditorController(drillId, pageId);
  return (
    <PlaceholderScreen
      title={
        pageId === "new" ? `Add ${terms.singular}` : `Edit ${terms.singular}`
      }
      description={`Enter the ${terms.lowercaseSingular} coordinate using structured field references.`}
    />
  );
}
