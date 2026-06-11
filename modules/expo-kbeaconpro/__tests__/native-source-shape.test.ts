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
});
