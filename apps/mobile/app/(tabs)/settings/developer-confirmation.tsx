import { Redirect } from "expo-router";

/** Legacy route kept only so stale deep links land on the current settings UI. */
export default function DeveloperConfirmationRoute() {
  return <Redirect href="/(tabs)/settings/developer" />;
}
