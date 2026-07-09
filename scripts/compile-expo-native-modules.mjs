import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(rootDir, "apps", "mobile");
const iosDir = join(appDir, "ios");
const androidDir = join(appDir, "android");
const generatedNativeDirs = [iosDir, androidDir];
const existingNativeDirs = generatedNativeDirs.filter(existsSync);
const outputDir = process.env.RUNNER_TEMP
  ? join(process.env.RUNNER_TEMP, "eight2five-native-module-builds")
  : join(rootDir, ".native-module-builds");

if (existingNativeDirs.length > 0) {
  throw new Error(
    `Refusing to replace existing generated native directories: ${existingNativeDirs.join(
      ", "
    )}. ` + "Run this validation from a clean Expo checkout."
  );
}

try {
  run("npx", ["expo", "prebuild", "--clean", "--no-install"], appDir);
  run("pod", ["install"], iosDir);
  run(
    "npx",
    [
      "expo",
      "run:ios",
      "--device",
      "generic",
      "--configuration",
      "Debug",
      "--no-install",
      "--no-bundler",
      "--output",
      outputDir,
    ],
    appDir
  );
  run(join(androidDir, "gradlew"), [":app:assembleDebug"], androidDir);
} finally {
  generatedNativeDirs.forEach((directory) => {
    if (existsSync(directory)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  if (!process.env.RUNNER_TEMP && existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}`
    );
  }
}
