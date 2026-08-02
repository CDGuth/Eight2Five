import {
  COLOR_PRESETS,
  countPrimarySets,
  fieldDefinitionSchema,
  getFieldPreset,
  parseDrillDocument,
  type DrillDocument,
  type DrillPath,
  type EntityIcon,
  type EntityRuleValues,
  type EntityRules,
  type FieldDefinition,
  type FieldPresetId,
} from "@eight2five/drill-schema";

export const FIELD_PRESET_OPTIONS = Object.freeze([
  { value: "football-nfhs", label: "High School (NFHS)" },
  { value: "football-ncaa", label: "College (NCAA)" },
  { value: "football-texas-uil", label: "Texas High School (UIL)" },
  { value: "football-nfl", label: "Professional (NFL)" },
] as const satisfies readonly {
  value: FieldPresetId;
  label: string;
}[]);

export const ENTITY_ICON_OPTIONS = Object.freeze([
  "dot",
  "square",
  "triangle",
  "diamond",
  "star",
  "hexagon",
  "cross",
] as const satisfies readonly EntityIcon[]);

export const COLOR_PRESET_OPTIONS = Object.freeze([
  { label: "Grey", value: COLOR_PRESETS.grey },
  { label: "Red", value: COLOR_PRESETS.red },
  { label: "Orange", value: COLOR_PRESETS.orange },
  { label: "Yellow", value: COLOR_PRESETS.yellow },
  { label: "Green", value: COLOR_PRESETS.green },
  { label: "Blue", value: COLOR_PRESETS.blue },
  { label: "Indigo", value: COLOR_PRESETS.indigo },
  { label: "Violet", value: COLOR_PRESETS.violet },
] as const);

export type RuleTarget = "symbol" | "label" | "id";
export type LabelVisibility = "inherit" | "visible" | "hidden";

export interface EntityRuleDraft {
  readonly id: string;
  readonly target: RuleTarget;
  readonly key: string;
  readonly section: string;
  readonly instrument: string;
  readonly icon: "" | EntityIcon;
  readonly color: string;
  readonly labelVisibility: LabelVisibility;
}

export interface ConverterSettings {
  readonly title: string;
  readonly drillWriter: string;
  readonly ensemble: string;
  readonly description: string;
  readonly lucideIcon: string;
  readonly fieldMode: FieldPresetId | "custom";
  readonly customFieldJson: string;
  readonly propSymbols: readonly string[];
  readonly rules: readonly EntityRuleDraft[];
  readonly includeSourceReferences: boolean;
  readonly explicitStraightPaths: boolean;
}

export interface ConverterSettingsValidation {
  readonly field?: FieldDefinition;
  readonly entityRules?: EntityRules;
  readonly errors: readonly string[];
}

export function createDefaultConverterSettings(): ConverterSettings {
  return {
    title: "",
    drillWriter: "",
    ensemble: "",
    description: "",
    lucideIcon: "",
    fieldMode: "football-nfhs",
    customFieldJson: createDefaultCustomFieldJson(),
    propSymbols: [],
    rules: [],
    includeSourceReferences: true,
    explicitStraightPaths: false,
  };
}

export function createDefaultCustomFieldJson(): string {
  const preset = getFieldPreset("football-nfhs");
  return JSON.stringify(
    {
      type: "custom",
      name: "Custom Football Field",
      physicalGeometry: preset.physicalGeometry,
      marchingGrid: preset.marchingGrid,
    } satisfies FieldDefinition,
    null,
    2,
  );
}

export function createEmptyRuleDraft(id: string): EntityRuleDraft {
  return {
    id,
    target: "symbol",
    key: "",
    section: "",
    instrument: "",
    icon: "",
    color: "",
    labelVisibility: "inherit",
  };
}

export function validateConverterSettings(
  settings: ConverterSettings,
): ConverterSettingsValidation {
  const errors: string[] = [];
  const title = settings.title.trim();
  if (!title) errors.push("A drill title is required.");

  let field: FieldDefinition | undefined;
  if (settings.fieldMode === "custom") {
    try {
      const parsedJson = JSON.parse(settings.customFieldJson) as unknown;
      const parsed = fieldDefinitionSchema.safeParse(parsedJson);
      if (!parsed.success || parsed.data.type !== "custom") {
        errors.push(
          parsed.success
            ? 'Custom field JSON must have type "custom".'
            : `Custom field is invalid: ${
                parsed.error.issues[0]?.message ?? "unknown validation error"
              }`,
        );
      } else {
        field = parsed.data;
      }
    } catch (cause) {
      errors.push(
        cause instanceof Error
          ? `Custom field JSON is invalid: ${cause.message}`
          : "Custom field JSON is invalid.",
      );
    }
  } else {
    field = { type: "preset", preset: settings.fieldMode };
  }

  const entityRules = buildEntityRules(settings.rules, errors);
  for (const symbol of settings.propSymbols) {
    if (!symbol.trim()) errors.push("Prop symbols cannot be blank.");
  }

  return {
    ...(field ? { field } : {}),
    ...(entityRules ? { entityRules } : {}),
    errors,
  };
}

export function applyConverterSettings(
  source: DrillDocument,
  settings: ConverterSettings,
  validation = validateConverterSettings(settings),
): DrillDocument {
  if (validation.errors.length > 0 || !validation.field) {
    throw new Error(validation.errors[0] ?? "Converter settings are invalid.");
  }

  const propSymbols = new Set(settings.propSymbols);
  const entities = source.entities.map((entity) => ({
    ...entity,
    type: propSymbols.has(entity.symbol) ? ("prop" as const) : entity.type,
  }));
  const paths = settings.explicitStraightPaths
    ? createStraightPaths(source)
    : source.paths;
  const provenance = source.provenance
    ? {
        ...source.provenance,
        ...(settings.includeSourceReferences ? {} : { references: undefined }),
      }
    : undefined;

  return parseDrillDocument({
    ...source,
    metadata: {
      title: settings.title.trim(),
      createdAt: source.metadata.createdAt,
      ...optionalText("drillWriter", settings.drillWriter),
      ...optionalText("ensemble", settings.ensemble),
      ...(settings.description.trim()
        ? { description: settings.description.trim() }
        : {}),
      ...optionalText("lucideIcon", settings.lucideIcon),
    },
    field: validation.field,
    ...(validation.entityRules && hasRules(validation.entityRules)
      ? { entityRules: validation.entityRules }
      : { entityRules: undefined }),
    entities,
    ...(paths && paths.length > 0 ? { paths } : { paths: undefined }),
    ...(provenance ? { provenance } : { provenance: undefined }),
  });
}

export function getDocumentSummary(document: DrillDocument) {
  return {
    performers: document.entities.filter(
      (entity) => entity.type === "performer",
    ).length,
    props: document.entities.filter((entity) => entity.type === "prop").length,
    primarySets: countPrimarySets(document.sets),
    setEntries: document.sets.length,
    positions: document.positions.length,
  };
}

export function inferTitleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function downloadFileName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "drill"}.eight2five.json`;
}

function buildEntityRules(
  drafts: readonly EntityRuleDraft[],
  errors: string[],
): EntityRules | undefined {
  const bySymbol: Record<string, EntityRuleValues> = {};
  const byLabel: Record<string, EntityRuleValues> = {};
  const byId: Record<string, EntityRuleValues> = {};
  const seen = new Set<string>();

  for (const [index, draft] of drafts.entries()) {
    const key = draft.key.trim();
    if (!key) {
      errors.push(`Rule ${index + 1} needs a ${draft.target} key.`);
      continue;
    }
    if (draft.target === "id") {
      const parsed = Number(key);
      if (!/^(?:0|[1-9][0-9]*)$/.test(key) || !Number.isSafeInteger(parsed)) {
        errors.push(
          `Rule ${index + 1} ID must be a non-negative safe integer.`,
        );
        continue;
      }
    }
    if (draft.target === "symbol" && (key.length > 16 || !key.trim())) {
      errors.push(`Rule ${index + 1} symbol must be 1-16 characters.`);
      continue;
    }
    const identity = `${draft.target}:${key}`;
    if (seen.has(identity)) {
      errors.push(`Duplicate ${draft.target} rule for ${key}.`);
      continue;
    }
    seen.add(identity);

    const color = draft.color.trim();
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      errors.push(`Rule ${index + 1} color must be a six-digit hex value.`);
      continue;
    }

    const appearance = {
      ...(draft.icon ? { icon: draft.icon } : {}),
      ...(color ? { color } : {}),
      ...(draft.labelVisibility === "inherit"
        ? {}
        : { labelVisible: draft.labelVisibility === "visible" }),
    };
    const values: EntityRuleValues = {
      ...optionalText("section", draft.section),
      ...optionalText("instrument", draft.instrument),
      ...(Object.keys(appearance).length > 0 ? { appearance } : {}),
    };
    if (Object.keys(values).length === 0) continue;
    if (draft.target === "symbol") bySymbol[key] = values;
    else if (draft.target === "label") byLabel[key] = values;
    else byId[key] = values;
  }

  const rules: EntityRules = {
    ...(Object.keys(bySymbol).length > 0 ? { bySymbol } : {}),
    ...(Object.keys(byLabel).length > 0 ? { byLabel } : {}),
    ...(Object.keys(byId).length > 0 ? { byId } : {}),
  };
  return hasRules(rules) ? rules : undefined;
}

function createStraightPaths(document: DrillDocument): DrillPath[] {
  const positionKeys = new Set(
    document.positions.map(
      (position) => `${position.entityId}|${position.setId}`,
    ),
  );
  const paths: DrillPath[] = [];
  for (const entity of document.entities) {
    for (
      let fromSetId = 0;
      fromSetId < document.sets.length - 1;
      fromSetId += 1
    ) {
      const toSetId = fromSetId + 1;
      if (
        positionKeys.has(`${entity.id}|${fromSetId}`) &&
        positionKeys.has(`${entity.id}|${toSetId}`)
      ) {
        paths.push({
          entityId: entity.id,
          fromSetId,
          toSetId,
          kind: "straight",
        });
      }
    }
  }
  return paths;
}

function optionalText<Key extends string>(
  key: Key,
  value: string,
): Record<Key, string> | Record<string, never> {
  const trimmed = value.trim();
  return trimmed ? ({ [key]: trimmed } as Record<Key, string>) : {};
}

function hasRules(rules: EntityRules): boolean {
  return Boolean(
    Object.keys(rules.bySymbol ?? {}).length ||
    Object.keys(rules.byLabel ?? {}).length ||
    Object.keys(rules.byId ?? {}).length,
  );
}
