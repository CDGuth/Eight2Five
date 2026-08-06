/** The user-facing noun chosen for a drill's ordered pages. */
export type DrillTerminology = "pages" | "sets";

/** Literal labels returned by the centralized terminology helper. */
export interface DrillTerms {
  readonly singular: "Page" | "Set";
  readonly plural: "Pages" | "Sets";
  readonly lowercaseSingular: "page" | "set";
  readonly lowercasePlural: "pages" | "sets";
}

const PAGE_TERMS: DrillTerms = Object.freeze({
  singular: "Page",
  plural: "Pages",
  lowercaseSingular: "page",
  lowercasePlural: "pages",
});

const SET_TERMS: DrillTerms = Object.freeze({
  singular: "Set",
  plural: "Sets",
  lowercaseSingular: "set",
  lowercasePlural: "sets",
});

/** Keeps terminology selection in one place so UI labels cannot drift. */
export function getDrillTerms(terminology: DrillTerminology): DrillTerms {
  if (terminology === "pages") return PAGE_TERMS;
  if (terminology === "sets") return SET_TERMS;
  throw new RangeError(`Unknown drill terminology: ${String(terminology)}.`);
}
