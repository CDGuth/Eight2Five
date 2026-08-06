import { shouldShowTransitionCountControls } from "../settings-screen-policy";

describe("settings screen transition count policy", () => {
  test("hides detailed count controls when Show all is enabled", () => {
    expect(shouldShowTransitionCountControls(true)).toBe(false);
    expect(shouldShowTransitionCountControls(false)).toBe(true);
  });
});
