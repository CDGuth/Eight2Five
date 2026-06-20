import { readFileSync } from "node:fs";
import path from "node:path";

const moduleRoot = path.resolve(__dirname, "..");

function readModuleSource(relativePath: string): string {
  return readFileSync(path.join(moduleRoot, relativePath), "utf8");
}

describe("native source API shape", () => {
  test("iOS requestPermissions defers while CoreBluetooth authorization is undetermined", () => {
    const source = readModuleSource("ios/ExpoPansBleApiModule.swift");

    expect(source).toContain("private var pendingPermissionPromise: Promise?");
    expect(source).toContain("self.requestBluetoothPermission(promise)");
    expect(source).toContain("settlePendingPermissionForCentralState");
    expect(source).toContain('bluetoothStatus != "undetermined"');
    expect(source).toContain("state != .unknown && state != .resetting");
    expect(source).toContain("pendingPermissionPromise?.reject");
    expect(source).not.toContain("promise.resolve(self.permissionStatusMap())");
  });

  test("iOS CoreBluetooth delegates are isolated behind an NSObject proxy", () => {
    const source = readModuleSource("ios/ExpoPansBleApiModule.swift");

    expect(source).toContain("public class ExpoPansBleApiModule: Module {");
    expect(source).not.toContain(
      "public class ExpoPansBleApiModule: Module, CBCentralManagerDelegate",
    );
    expect(source).toContain(
      "private final class ExpoPansBleApiBluetoothDelegate: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate",
    );
    expect(source).toContain(
      "CBCentralManager(delegate: ensureBluetoothDelegate()",
    );
    expect(source).toContain(
      "peripheral.delegate = self.ensureBluetoothDelegate()",
    );
  });
});
