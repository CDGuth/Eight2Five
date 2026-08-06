import type {
  DrillEntity,
  EntityAppearance,
  EntityRuleValues,
  EntityRules,
  PropSize,
  PropSizeUnit,
  ResolvedDrillEntity,
  ResolvedEntityAppearance,
} from "./types";

export const DEFAULT_ENTITY_COLOR = "#808080" as const;
export const EIGHT_TO_FIVE_STEP_INCHES = 22.5 as const;
export const DEFAULT_PROP_SIZE = Object.freeze({
  length: 1,
  width: 1,
  unit: "8-to-5-steps",
} as const satisfies PropSize);

export const COLOR_PRESETS = Object.freeze({
  grey: DEFAULT_ENTITY_COLOR,
  red: "#E53935",
  orange: "#FB8C00",
  yellow: "#FDD835",
  green: "#43A047",
  lightBlue: "#64B5F6",
  blue: "#3C6EC8",
  darkBlue: "#1E3A8A",
  purple: "#8E44AD",
  pink: "#EC4899",
  black: "#000000",
} as const);

export function resolveDrillEntity(
  entity: DrillEntity,
  rules?: EntityRules,
): ResolvedDrillEntity {
  const symbolRule = rules?.bySymbol?.[entity.symbol];
  const labelRule = rules?.byLabel?.[entity.label];
  const idRule = rules?.byId?.[String(entity.id)];
  const mergedRule = resolveEntityRuleValues(entity, rules);
  const type = entity.type ?? mergedRule.type ?? "performer";
  const name = entity.name ?? mergedRule.name;
  const section = type === "prop" ? undefined : entity.section ?? mergedRule.section;
  const instrument =
    type === "prop" ? undefined : entity.instrument ?? mergedRule.instrument;
  const size =
    type === "prop"
      ? entity.size ?? mergedRule.size ?? DEFAULT_PROP_SIZE
      : undefined;

  return {
    ...entity,
    type,
    ...(name === undefined ? {} : { name }),
    ...(section === undefined ? {} : { section }),
    ...(instrument === undefined ? {} : { instrument }),
    ...(size === undefined ? {} : { size }),
    appearance: resolveAppearance(
      type,
      symbolRule?.appearance,
      labelRule?.appearance,
      idRule?.appearance,
      entity.appearance,
    ),
  };
}

export function resolveEntityRuleValues(
  entity: Pick<DrillEntity, "id" | "symbol" | "label">,
  rules?: EntityRules,
): EntityRuleValues {
  return mergeRuleValues(
    rules?.bySymbol?.[entity.symbol],
    rules?.byLabel?.[entity.label],
    rules?.byId?.[String(entity.id)],
  );
}

export function resolveEntityAppearance(
  entity: DrillEntity,
  rules?: EntityRules,
): ResolvedEntityAppearance {
  return resolveDrillEntity(entity, rules).appearance;
}

export function resolvePropSize(
  entity: DrillEntity,
  rules?: EntityRules,
): PropSize | undefined {
  const resolved = resolveDrillEntity(entity, rules);
  return resolved.type === "prop" ? resolved.size ?? DEFAULT_PROP_SIZE : undefined;
}

export function convertPropSizeValue(
  value: number,
  fromUnit: PropSizeUnit,
  toUnit: PropSizeUnit,
): number {
  if (fromUnit === toUnit) return value;
  const meters = value * propSizeUnitMeters(fromUnit);
  return meters / propSizeUnitMeters(toUnit);
}

function propSizeUnitMeters(unit: PropSizeUnit): number {
  switch (unit) {
    case "8-to-5-steps":
      return EIGHT_TO_FIVE_STEP_INCHES * 0.0254;
    case "feet":
      return 0.3048;
    case "inches":
      return 0.0254;
    case "meters":
      return 1;
  }
}

function resolveAppearance(
  type: DrillEntity["type"],
  ...appearances: readonly (EntityAppearance | undefined)[]
): ResolvedEntityAppearance {
  let resolved: ResolvedEntityAppearance = {
    icon: type === "prop" ? "square" : "dot",
    color: DEFAULT_ENTITY_COLOR,
    labelVisible: true,
  };
  for (const appearance of appearances) {
    if (!appearance) continue;
    resolved = {
      icon: appearance.icon ?? resolved.icon,
      color: appearance.color ?? resolved.color,
      labelVisible: appearance.labelVisible ?? resolved.labelVisible,
    };
  }
  return resolved;
}

function mergeRuleValues(
  ...values: readonly (EntityRuleValues | undefined)[]
): EntityRuleValues {
  let type: EntityRuleValues["type"];
  let name: string | undefined;
  let section: string | undefined;
  let instrument: string | undefined;
  let size: PropSize | undefined;
  let appearance: EntityAppearance | undefined;
  for (const value of values) {
    if (!value) continue;
    type = value.type ?? type;
    name = value.name ?? name;
    section = value.section ?? section;
    instrument = value.instrument ?? instrument;
    size = value.size ?? size;
    if (value.appearance) {
      appearance = {
        ...(appearance ?? {}),
        ...value.appearance,
      };
    }
  }
  return {
    ...(type === undefined ? {} : { type }),
    ...(name === undefined ? {} : { name }),
    ...(section === undefined ? {} : { section }),
    ...(instrument === undefined ? {} : { instrument }),
    ...(size === undefined ? {} : { size }),
    ...(appearance === undefined ? {} : { appearance }),
  };
}
