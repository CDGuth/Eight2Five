import * as ScreenOrientation from "expo-screen-orientation";

export function getMobileOrientationLock(
  pathname: string,
): ScreenOrientation.OrientationLock {
  const fieldRoute = pathname === "/field" || pathname.startsWith("/field/");

  return fieldRoute
    ? ScreenOrientation.OrientationLock.DEFAULT
    : ScreenOrientation.OrientationLock.PORTRAIT_UP;
}
