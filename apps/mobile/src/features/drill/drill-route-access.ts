import type { AppSettingsStoreStatus } from "../../state/app-settings-store";

export type DrillRouteAccess = "loading" | "allowed" | "redirect";

export function getDrillRouteAccess(
  status: AppSettingsStoreStatus,
  drillFeaturesEnabled: boolean,
): DrillRouteAccess {
  if (status === "loading") return "loading";
  return status === "ready" && drillFeaturesEnabled ? "allowed" : "redirect";
}
