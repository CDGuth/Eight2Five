import {
  EIGHT2FIVE_APP_NAME,
  EIGHT2FIVE_APP_VERSION,
  EIGHT2FIVE_GITHUB_URL,
  EIGHT2FIVE_LICENSE_URL,
  INFO_UNAVAILABLE,
  getMobileInfoMetadata,
  getShortGitSha,
} from "../info-metadata";

describe("mobile info metadata", () => {
  test("uses the iOS build number and shortens the injected SHA", () => {
    expect(
      getMobileInfoMetadata(
        {
          name: EIGHT2FIVE_APP_NAME,
          version: EIGHT2FIVE_APP_VERSION,
          ios: { buildNumber: "42" },
          android: { versionCode: 7 },
          extra: {
            EIGHT2FIVE_GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
          },
        },
        "ios",
      ),
    ).toEqual({
      appName: EIGHT2FIVE_APP_NAME,
      version: EIGHT2FIVE_APP_VERSION,
      nativeBuildLabel: "iOS build number",
      nativeBuildValue: "42",
      gitSha: "0123456",
    });
  });

  test("uses the Android version code and exposes the external targets", () => {
    const metadata = getMobileInfoMetadata(
      {
        android: { versionCode: 7 },
        extra: { EIGHT2FIVE_GIT_SHA: "abcdef1" },
      },
      "android",
    );

    expect(metadata.nativeBuildLabel).toBe("Android version code");
    expect(metadata.nativeBuildValue).toBe("7");
    expect(metadata.gitSha).toBe("abcdef1");
    expect(EIGHT2FIVE_LICENSE_URL).toBe(
      `${EIGHT2FIVE_GITHUB_URL}/blob/main/LICENSE`,
    );
  });

  test("prefers the build identifier reported by the installed native app", () => {
    expect(
      getMobileInfoMetadata({ ios: { buildNumber: "1" } }, "ios", "84")
        .nativeBuildValue,
    ).toBe("84");
  });

  test("does not fabricate missing or invalid build metadata", () => {
    expect(getMobileInfoMetadata(undefined, "ios")).toMatchObject({
      appName: EIGHT2FIVE_APP_NAME,
      version: EIGHT2FIVE_APP_VERSION,
      nativeBuildValue: INFO_UNAVAILABLE,
      gitSha: INFO_UNAVAILABLE,
    });
    expect(getShortGitSha("local")).toBe(INFO_UNAVAILABLE);
    expect(getShortGitSha("not-a-sha")).toBe(INFO_UNAVAILABLE);
  });
});
