import type { Href } from "expo-router";

export interface SubappConfig {
  id: string;
  title: string;
  description: string;
  badge?: string;
  routeName: `(subapps)/${string}`;
  href: Href;
}

/**
 * Registry of testbed subapps. Currently empty while the optimization
 * playground has been retired; the scaffolding remains so new subapps can be
 * registered here without re-establishing the routing/layout plumbing.
 */
export const SUBAPPS: readonly SubappConfig[] = [];

export type SubappId = SubappConfig["id"];
export type TestbedSubapp = SubappConfig;

export function getSubappById(id: SubappId): TestbedSubapp {
  const subapp = SUBAPPS.find((entry) => entry.id === id);
  if (!subapp) {
    throw new Error(`Unknown testbed subapp: ${id}`);
  }
  return subapp;
}
