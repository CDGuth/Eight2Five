import { getDrillTerms } from "../index";

describe("drill terminology", () => {
  test("centralizes Page labels", () => {
    expect(getDrillTerms("pages")).toEqual({
      singular: "Page",
      plural: "Pages",
      lowercaseSingular: "page",
      lowercasePlural: "pages",
    });
  });

  test("centralizes Set labels", () => {
    expect(getDrillTerms("sets")).toEqual({
      singular: "Set",
      plural: "Sets",
      lowercaseSingular: "set",
      lowercasePlural: "sets",
    });
  });

  test("reuses immutable canonical term objects", () => {
    expect(getDrillTerms("pages")).toBe(getDrillTerms("pages"));
    expect(Object.isFrozen(getDrillTerms("pages"))).toBe(true);
  });
});
