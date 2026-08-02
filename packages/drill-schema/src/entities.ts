import type {
  DrillEntity,
  EntityAppearance,
  EntityRuleValues,
  EntityRules,
  ResolvedDrillEntity,
  ResolvedEntityAppearance,
} from "./types";

export const DEFAULT_ENTITY_COLOR = "#808080" as const;

export const COLOR_PRESETS = Object.freeze({
  red: "#E53935",
  orange: "#FB8C00",
  yellow: "#FDD835",
  green: "#43A047",
  blue: "#3C6EC8",
  indigo: "#4F51B5",
  violet: "#8E44AD",
  grey: DEFAULT_ENTITY_COLOR,
} as const);

export function resolveDrillEntity(
  entity: DrillEntity,
  rules?: EntityRules,
): ResolvedDrillEntity {
  const symbolRule = rules?.bySymbol?.[entity.symbol];
  const labelRule = rules?.byLabel?.[entity.label];
  const idRule = rules?.byId?.[String(entity.id)];

  const mergedRule = mergeRuleValues(symbolRule, labelRule, idRule);
  return {
    ...entity,
    ...(mergedRule.section === undefined ? {} : { section: mergedRule.section }),
    ...(mergedRule.instrument === undefined
      ? {}
      : { instrument: mergedRule.instrument }),
    ...(entity.section === undefined ? {} : { section: entity.section }),
    ...(entity.instrument === undefined ? {} : { instrument: entity.instrument }),
    appearance: resolveAppearance(
      entity.type,
      symbolRule?.appearance,
      labelRule?.appearance,
      idRule?.appearance,
      entity.appearance,
    ),
  };
}

export function resolveEntityAppearance(
  entity: DrillEntity,
  rules?: EntityRules,
): ResolvedEntityAppearance {
  return resolveDrillEntity(entity, rules).appearance;
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
  let section: string | undefined;
  let instrument: string | undefined;
  for (const value of values) {
    if (!value) continue;
    section = value.section ?? section;
    instrument = value.instrument ?? instrument;
  }
  return {
    ...(section === undefined ? {} : { section }),
    ...(instrument === undefined ? {} : { instrument }),
  };
}
