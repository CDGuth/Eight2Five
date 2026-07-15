import { readFileSync } from "node:fs";

const [manifestPath, expectedBuildId, expectedVersionCode] = process.argv.slice(2);

if (!manifestPath) {
  throw new Error(
    "Usage: verify-pans-android-manifest.mjs <manifest.xml> [build-id] [version-code]",
  );
}

const manifest = readFileSync(manifestPath, "utf8");
const permissionTags = Array.from(
  manifest.matchAll(/<uses-permission\b[^>]*>/g),
  (match) => match[0],
);

const permissions = new Map(
  permissionTags
    .map((tag) => [attribute(tag, "android:name"), tag])
    .filter(([name]) => Boolean(name)),
);

for (const name of [
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
]) {
  if (!permissions.has(name)) fail(`Missing required permission ${name}.`);
}

for (const name of [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
]) {
  const tag = permissions.get(name) ?? "";
  if (attribute(tag, "android:maxSdkVersion")) {
    fail(`${name} must not be capped by maxSdkVersion.`);
  }
}

const scanPermission = permissions.get("android.permission.BLUETOOTH_SCAN") ?? "";
if (attribute(scanPermission, "android:usesPermissionFlags")?.includes("neverForLocation")) {
  fail("BLUETOOTH_SCAN must not assert neverForLocation for this localization app.");
}

for (const name of [
  "android.permission.BLUETOOTH",
  "android.permission.BLUETOOTH_ADMIN",
]) {
  const tag = permissions.get(name);
  if (!tag) fail(`Missing legacy permission ${name}.`);
  if (attribute(tag ?? "", "android:maxSdkVersion") !== "30") {
    fail(`${name} must be capped at Android 11 (API 30).`);
  }
}

if (expectedBuildId) {
  const metadataTag = Array.from(
    manifest.matchAll(/<meta-data\b[^>]*>/g),
    (match) => match[0],
  ).find(
    (tag) =>
      attribute(tag, "android:name") === "expo.modules.pansbleapi.BUILD_ID",
  );
  if (!metadataTag) fail("Missing native PANS build identifier metadata.");
  if (attribute(metadataTag ?? "", "android:value") !== expectedBuildId) {
    fail("Native PANS build identifier does not match the requested build SHA.");
  }
}

if (expectedVersionCode) {
  const manifestTag = manifest.match(/<manifest\b[^>]*>/)?.[0] ?? "";
  if (attribute(manifestTag, "android:versionCode") !== expectedVersionCode) {
    fail("Android versionCode does not match the unique workflow run number.");
  }
}

console.log("Verified final Android BLE permissions and build identity.");

function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`${escaped}="([^"]*)"`))?.[1];
}

function fail(message) {
  throw new Error(`Invalid merged Android manifest: ${message}`);
}
