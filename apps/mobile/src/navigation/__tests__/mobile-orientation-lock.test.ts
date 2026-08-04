import * as ScreenOrientation from "expo-screen-orientation";

import { getMobileOrientationLock } from "../mobile-orientation";

describe("mobile route orientation", () => {
  test("allows device rotation only on Field routes", () => {
    expect(getMobileOrientationLock("/field")).toBe(
      ScreenOrientation.OrientationLock.DEFAULT,
    );
    expect(getMobileOrientationLock("/field/details")).toBe(
      ScreenOrientation.OrientationLock.DEFAULT,
    );
  });

  test.each(["/", "/drill", "/drill/example", "/settings", "/settings/tag"])(
    "locks %s to upright portrait",
    (pathname) => {
      expect(getMobileOrientationLock(pathname)).toBe(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    },
  );
});
