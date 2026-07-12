import { SUBAPPS, getSubappById } from "..";

describe("testbed subapp registry", () => {
  it("has unique ids and route names", () => {
    const ids = new Set(SUBAPPS.map((subapp) => subapp.id));
    const routeNames = new Set(SUBAPPS.map((subapp) => subapp.routeName));

    expect(ids.size).toBe(SUBAPPS.length);
    expect(routeNames.size).toBe(SUBAPPS.length);
  });

  it("provides metadata required by routes and home cards", () => {
    for (const subapp of SUBAPPS) {
      expect(subapp.id).toBeTruthy();
      expect(subapp.title).toBeTruthy();
      expect(subapp.description).toBeTruthy();
      expect(subapp.routeName).toMatch(/^\(subapps\)\//);
      expect(subapp.href).toBe(`/${subapp.routeName}`);
      expect(getSubappById(subapp.id).title).toBe(subapp.title);
    }
  });

  it("registers the DWM1001 manager", () => {
    expect(getSubappById("dwm1001-manager")).toEqual(
      expect.objectContaining({
        title: "DWM1001 Network Manager",
        badge: "Hardware",
        href: "/(subapps)/dwm1001-manager",
      }),
    );
  });

  it("rejects unknown subapp ids", () => {
    expect(() => getSubappById("missing")).toThrow(
      "Unknown testbed subapp: missing",
    );
  });
});
