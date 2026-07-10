import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreDir = join(rootDir, "modules", "expo-pans-ble-api", "android-core");
const buildFile = join(coreDir, "build.gradle.kts");
const coreSource = join(
  coreDir,
  "src",
  "main",
  "kotlin",
  "expo",
  "modules",
  "pansbleapi",
  "PansBleApiCore.kt",
);
const coreTest = join(
  coreDir,
  "src",
  "test",
  "kotlin",
  "expo",
  "modules",
  "pansbleapi",
  "PansBleApiCoreTest.kt",
);

assertFileExists(buildFile);
assertFileExists(coreSource);
assertFileExists(coreTest);

const gradleCommand = findGradleCommand();
const args = ["--no-daemon", "--console=plain", "cleanTest", "test"];
const result = spawnSync(gradleCommand.command, [...gradleCommand.args, ...args], {
  cwd: coreDir,
  encoding: "utf8",
  shell: process.platform === "win32" && gradleCommand.shell === true,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`Kotlin JVM tests failed with exit code ${result.status}`);
}

function assertFileExists(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Required Kotlin JVM test file not found: ${filePath}`);
  }
}

function findGradleCommand() {
  const wrapperCandidates = [
    join(rootDir, "node_modules", "@react-native", "gradle-plugin", process.platform === "win32" ? "gradlew.bat" : "gradlew"),
    join(rootDir, "node_modules", "react-native-reanimated", "android", process.platform === "win32" ? "gradlew.bat" : "gradlew"),
  ];

  for (const candidate of wrapperCandidates) {
    if (existsSync(candidate)) {
      return {
        command: candidate,
        args: [],
        shell: false,
      };
    }
  }

  return {
    command: "gradle",
    args: [],
    shell: true,
  };
}
