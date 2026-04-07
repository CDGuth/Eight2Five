export type SubappId = "optimization";

export interface TestbedSubapp {
  id: SubappId;
  title: string;
  description: string;
  badge?: string;
  href: "/(subapps)/optimization";
}

export const SUBAPPS: TestbedSubapp[] = [
  {
    id: "optimization",
    title: "Optimization Test",
    description:
      "Experiment with optimization-based localization, propagation constants, noise models, and variable sweep runs.",
    href: "/(subapps)/optimization",
  },
];
