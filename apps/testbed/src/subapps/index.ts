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
    id: "dwm1001-manager",
    title: "DWM1001 Network Manager",
    description:
      "Discover, configure, inspect, and visualize DWM1001 PANS networks.",
    badge: "Hardware",
    routeName: "(subapps)/dwm1001-manager",
    href: "/(subapps)/dwm1001-manager" as Href,
  },
] as const satisfies readonly SubappConfig[];

export type SubappId = SubappConfig["id"];
export type TestbedSubapp = SubappConfig;

export function getSubappById(id: string): TestbedSubapp {
  const subapp = SUBAPPS.find((entry) => entry.id === id);
  if (!subapp) {
    throw new Error(`Unknown testbed subapp: ${id}`);
  }
  return subapp;
}
