import type { Href } from "expo-router";

export interface SubappConfig {
  id: string;
  title: string;
  description: string;
  badge?: string;
  routeName: `(subapps)/${string}`;
  href: Href;
}

export const SUBAPPS = [
  {
    id: "optimization" as const,
    title: "Optimization Test",
    description:
      "Experiment with optimization-based localization, propagation constants, noise models, and variable sweep runs.",
    routeName: "(subapps)/optimization",
    href: "/(subapps)/optimization" as Href,
  },
] satisfies SubappConfig[];

export type SubappId = (typeof SUBAPPS)[number]["id"];
export type TestbedSubapp = SubappConfig & { id: SubappId };

export function getSubappById(id: SubappId): TestbedSubapp {
  const subapp = SUBAPPS.find((entry) => entry.id === id);
  if (!subapp) {
    throw new Error(`Unknown testbed subapp: ${id}`);
  }
  return subapp;
}
