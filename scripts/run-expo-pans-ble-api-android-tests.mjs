import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const moduleDir = join(rootDir, "modules", "expo-pans-ble-api");
const sourceFile = join(
  moduleDir,
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "pansbleapi",
  "PansBleApiJvmContract.java",
);
const testFile = join(
  moduleDir,
  "android",
  "src",
  "test",
  "java",
  "expo",
  "modules",
  "pansbleapi",
  "PansBleApiJvmContractTest.java",
);
const classesDir = mkdtempSync(join(tmpdir(), "expo-pans-ble-api-android-tests-"));

try {
  assertFileExists(sourceFile);
  assertFileExists(testFile);
  run("javac", ["-version"], { capture: true });
  run("java", ["-version"], { capture: true });
  run("javac", ["-d", classesDir, sourceFile, testFile]);
  run("java", ["-ea", "-cp", classesDir, "expo.modules.pansbleapi.PansBleApiJvmContractTest"]);
} finally {
  rmSync(classesDir, { recursive: true, force: true });
}

function assertFileExists(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Required Android JVM test source file not found: ${filePath}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (options.capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        `Required command '${command}' was not found. Install a JDK so expo-pans-ble-api Android JVM tests can run.`,
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status}: ${command} ${args.join(" ")}`,
    );
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
