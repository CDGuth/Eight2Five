import type { MenuAction } from "@expo/ui/community/menu";
import type { Drill } from "@eight2five/mobile/drill";

export const NO_DRILL_ACTION_ID = "__no-drill__";

export function createDrillMenuActions(
  drills: readonly Drill[],
  activeDrillId: string | null,
  disabled = false,
): MenuAction[] {
  return [
    {
      id: NO_DRILL_ACTION_ID,
      title: "No drill selected",
      state: activeDrillId === null ? "on" : "off",
      attributes: { disabled },
    },
    ...drills.map((drill) => ({
      id: drill.id,
      title: drill.name,
      state: activeDrillId === drill.id ? ("on" as const) : ("off" as const),
      attributes: { disabled },
    })),
  ];
}
