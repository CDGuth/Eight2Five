import { readFileSync } from "node:fs";
import path from "node:path";

const moduleRoot = path.resolve(__dirname, "..");

function readModuleSource(relativePath: string): string {
  return readFileSync(path.join(moduleRoot, relativePath), "utf8");
}

describe("native source API shape", () => {
  test("Android serializes BLE state and rejects stale scan callbacks", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/pansbleapi/ExpoPansBleApiModule.kt",
    );

    expect(source).toContain("ConcurrentHashMap<String, BluetoothDevice>()");
    expect(source).toContain("@Volatile private var isScanning = false");
    expect(source).toContain("createScanCallback(sessionId: Long)");
    expect(source).toContain("isActiveScanSession(sessionId)");
    expect(source).toContain(".runOnQueue(Queues.MAIN)");
    expect(source).toContain("OnActivityEntersBackground");
    expect(source).toContain("if (isScanning) stopScanSafely()");
    expect(source).toContain("scan.startScan(null, settings, callback)");
    expect(source).not.toContain("private val scanCallback = object");
  });

  test("Android bounds native discovery retention and event frequency", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/pansbleapi/ExpoPansBleApiModule.kt",
    );

    expect(source).toContain("scheduleDiscoveryEmit(now)");
    expect(source).toContain("removeExpiredDiscoveredDevices(now)");
    expect(source).toContain("DISCOVERY_EVENT_MIN_INTERVAL_MS = 250L");
    expect(source).toContain("NATIVE_DISCOVERY_RETENTION_MS = 60_000L");
  });

  test("native notification events expose sequence, monotonic time, and payload length", () => {
    const android = readModuleSource(
      "android/src/main/java/expo/modules/pansbleapi/ExpoPansBleApiModule.kt",
    );
    const ios = readModuleSource("ios/ExpoPansBleApiModule.swift");

    expect(android).toContain("notificationSequence.incrementAndGet()");
    expect(android).toContain("SystemClock.elapsedRealtimeNanos()");
    expect(android).toContain('"payloadLength" to value.size');
    expect(ios).toContain("notificationSequence &+= 1");
    expect(ios).toContain("ProcessInfo.processInfo.systemUptime * 1000.0");
    expect(ios).toContain('"payloadLength": payload.count');
  });

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
