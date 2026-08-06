import { getDrillTerms } from "@eight2five/mobile/drill";

import { getDrillRouteAccess } from "../drill-route-access";

describe("drill route and terminology behavior", () => {
  test("does not expose disabled or failed drill routes", () => {
    expect(getDrillRouteAccess("loading", true)).toBe("loading");
    expect(getDrillRouteAccess("ready", true)).toBe("allowed");
    expect(getDrillRouteAccess("ready", false)).toBe("redirect");
    expect(getDrillRouteAccess("error", true)).toBe("redirect");
  });

  test("keeps Pages and Sets as display-only terminology", () => {
    expect(getDrillTerms("pages")).toMatchObject({
      singular: "Page",
      plural: "Pages",
      lowercaseSingular: "page",
    });
    expect(getDrillTerms("sets")).toMatchObject({
      singular: "Set",
      plural: "Sets",
      lowercaseSingular: "set",
    });
  });
});
