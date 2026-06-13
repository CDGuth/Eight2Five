import { readFileSync } from "node:fs";
import path from "node:path";

const moduleRoot = path.resolve(__dirname, "..");

function readModuleSource(relativePath: string): string {
  return readFileSync(path.join(moduleRoot, relativePath), "utf8");
}

describe("native source API shape", () => {
  test("Android bridge avoids known invalid SDK symbols", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/kbeaconpro/ExpoKBeaconProModule.kt",
    );

    expect(source).not.toContain("KBScanProcessMgr");
    expect(source).not.toContain("readSensorHistory");
    expect(source).not.toContain("unsubscribeSensorDataNotify");
    expect(source).not.toContain('manager.javaClass.getMethod("release")');

    expect(source).toContain("KBeaconsMgr.KBeaconMgrDelegate");
    expect(source).toContain("onCentralBleStateChang");
    expect(source).toContain("onScanFailed");
    expect(source).toContain("KBeaconsMgr.clearBeaconManager");
    expect(source).toContain("readSensorRecord");
    expect(source).toContain("removeSubscribeSensorDataNotify");
  });

  test("iOS bridge avoids known invalid SDK symbols", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).not.toContain("KBeaconsMgrDelegate");
    expect(source).not.toContain("KBConnStateDelegate");
    expect(source).not.toContain("KBConnErr");
    expect(source).not.toContain("CBCentralManagerState");
    expect(source).not.toContain("sharedBeaconManager()");
    expect(source).not.toContain("beacon.mac()");
    expect(source).not.toContain("beacon.name()");
    expect(source).not.toContain("beacon.rssi()");
    expect(source).not.toContain("connectionState()");
    expect(source).not.toContain("isConnectable()");

    expect(source).toContain("KBeaconMgrDelegate");
    expect(source).toContain("ConnStateDelegate");
    expect(source).toContain("NotifyDataDelegate");
    expect(source).toContain("BLECentralMgrState");
    expect(source).toContain("KBConnEvtReason");
    expect(source).toContain("sharedBeaconManager");
    expect(source).toContain("startScanning()");
    expect(source).toContain("readSensorRecord");
    expect(source).toContain("removeSubscribeSensorDataNotify");
  });

  test("iOS bridge normalizes connection states and reasons", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).toContain(
      "private func connectionStateToJs(_ state: KBConnState) -> Int",
    );
    expect(source).toContain("case .Disconnected: return 0");
    expect(source).toContain("case .Connecting: return 1");
    expect(source).toContain("case .Connected: return 2");
    expect(source).toContain("case .Disconnecting: return 3");
    expect(source).toContain(
      "private func connectionReasonToJs(_ evt: KBConnEvtReason) -> Int",
    );
    expect(source).not.toContain('"state": state.rawValue');
    expect(source).not.toContain('"connectionState": beacon.state.rawValue');
    expect(source).not.toContain('"reason": evt.rawValue');
    expect(source).not.toContain("evt.rawValue");
  });

  test("Android bridge normalizes connection reasons", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/kbeaconpro/ExpoKBeaconProModule.kt",
    );

    expect(source).toContain(
      "private fun connectionReasonToJs(reason: Int): Int",
    );
    expect(source).toContain(
      'nativeConnectionReasonEquals(reason, "ConnTimeout")',
    );
    expect(source).toContain(
      'nativeConnectionReasonEquals(reason, "ConnAuthFail")',
    );
    expect(source).not.toContain('"reason" to nReason');
    expect(source).not.toContain('"reason" to reason\n');
  });

  test("iOS feature code avoids unguarded KVC", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).not.toContain(".value(forKey:");
    expect(source).not.toContain(".setValue(");
    expect(source).toContain(
      "optionalNumber(from object: NSObject, selectorName: String)",
    );
    expect(source).toContain("object.responds(to: selector)");
  });

  test("iOS snapshot builder includes cached sensor configuration", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).toContain("beacon.getSensorCfgList()");
    expect(source).toContain(
      'snapshot["sensors"] = sensorCfgList.map(sensorConfigToDict)',
    );
  });

  test("iOS scan startup defers while Bluetooth initializes", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).toContain("private var pendingScanPromise: Promise?");
    expect(source).toContain(
      "A scan start is already pending while Bluetooth initializes.",
    );
    expect(source).toContain("settlePendingScanForBluetoothState");
    expect(source).toContain("case .PowerOn:");
    expect(source).toContain("pendingScanPromise?.reject");
  });
});
