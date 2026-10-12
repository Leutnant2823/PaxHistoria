import type { Scenario } from "./types";
import { SCENARIO_1911 } from "./scenario1911";
import { SCENARIO_1935 } from "./scenario1935";

export const SCENARIOS: Scenario[] = [SCENARIO_1911, SCENARIO_1935];

export function getScenario(id: string | undefined): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIO_1911;
}
