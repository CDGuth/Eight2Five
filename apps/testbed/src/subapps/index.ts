import type { Href } from "expo-router";

export type SubappId = "optimization";

interface SubappConfig {
  id: SubappId;
  title: string;
  description: string;
  badge?: string;
  href: Href;
}

export const SUBAPPS = [
  {
    id: "optimization" as const,
    title: "Optimization Test",
    description:
      "Experiment with optimization-based localization, propagation constants, noise models, and variable sweep runs.",
    href: "/(subapps)/optimization" as Href,
  },
] satisfies SubappConfig[];

export type TestbedSubapp = SubappConfig;
