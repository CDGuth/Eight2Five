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
    expect(source).not.toContain('manager.javaClass.getMethod("release")');

    expect(source).toContain("KBeaconsMgr.KBeaconMgrDelegate");
    expect(source).toContain("onCentralBleStateChang");
    expect(source).toContain("onScanFailed");
    expect(source).toContain("KBeaconsMgr.clearBeaconManager");
    expect(source).toContain("readSensorRecord");
    expect(source).toContain("removeSubscribeSensorDataNotify");
  });

  test("Android bridge uses kbeaconlib2 1.3.3 config APIs", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/kbeaconpro/ExpoKBeaconProModule.kt",
    );

    expect(source).not.toContain("exception?.description");
    expect(source).toContain("sdkExceptionMessage(exception");
    expect(source).toContain(
      "clearSensorRecord(sensorType) { success, _, exception ->",
    );

    expect(source).not.toMatch(/\balwaysPowerOn\s*=/);
    expect(source).not.toMatch(/\badvTriggerOnly\s*=/);
    expect(source).not.toMatch(/\badvConnectable\s*=/);
    expect(source).not.toMatch(/\breportInterval\s*=/);
    expect(source).not.toMatch(/\btriggerAdvPeriod\s*=/);
    expect(source).not.toMatch(/\btriggerTxPower\s*=/);
    expect(source).not.toMatch(/\btriggerAdvChangeMode\s*=/);
    expect(source).not.toMatch(/\blogEnable\s*=/);
    expect(source).not.toMatch(/\bsensorHtMeasureInterval\s*=/);
    expect(source).not.toMatch(/\bhumidityChangeThreshold\s*=/);
    expect(source).not.toMatch(/\btemperatureChangeThreshold\s*=/);
    expect(source).not.toMatch(/\bscanModel\s*=/);

    expect(source).toContain("setAlwaysPowerOn(it)");
    expect(source).toContain("cfg.setAdvTriggerOnly(it)");
    expect(source).toContain("cfg.setAdvConnectable(it)");
    expect(source).toContain("setReportingInterval(it)");
    expect(source).toContain("cfg.setTriggerAdvPeriod(it)");
    expect(source).toContain(
      '"triggerAdvPeriod" to numberFromMethods(triggerCfg, "getTriggerAdvPeriod")?.toDouble()',
    );
    expect(source).toContain("cfg.setTriggerAdvTxPower(it)");
    expect(source).toContain("cfg.setTriggerAdvChangeMode(it)");
    expect(source).toContain("setLogEnable(it)");
    expect(source).toContain("setMeasureInterval(it)");
    expect(source).toContain("setHumidityLogThreshold(it)");
    expect(source).toContain("setTemperatureLogThreshold(it)");
    expect(source).toContain("setScanMode(it)");
  });

  test("Android snapshot builder uses kbeaconlib2 1.3.3 readback names", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/kbeaconpro/ExpoKBeaconProModule.kt",
    );

    expect(source).not.toContain('"getMaxSlot"');
    expect(source).not.toContain('"getMaxTrigger"');
    expect(source).not.toContain('"getTriggerAdvChangeMode"');
    expect(source).not.toContain('"getSensorHtMeasureInterval"');
    expect(source).not.toContain('"getHumidityChangeThreshold"');
    expect(source).not.toContain('"getTemperatureChangeThreshold"');
    expect(source).not.toContain('"isParkingTag"');
    expect(source).not.toContain('"getScanModel"');

    expect(source).toContain('"getMaxAdvSlot"');
    expect(source).toContain('"getMaxTriggerNum"');
    expect(source).toContain('"getTriggerAdvChgMode"');
    expect(source).toContain('"getMeasureInterval"');
    expect(source).toContain('"getHumidityChangeLogThreshold"');
    expect(source).toContain('"getTemperatureChangeLogThreshold"');
    expect(source).toContain('"isParkingTaged"');
    expect(source).toContain('"getScanMode"');
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

  test("iOS bridge uses kbeaconlib2 public setters and readback names", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).not.toContain("advPacket.advType.rawValue");
    expect(source).not.toMatch(/\bcfg\.deviceName\s*=/);
    expect(source).not.toMatch(/\bcfg\.alwaysPowerOn\s*=/);
    expect(source).not.toMatch(/\badvCfg\.slotIndex\s*=/);
    expect(source).not.toMatch(/\btriggerCfg\.triggerAdvChangeMode\s*=/);
    expect(source).not.toMatch(/\btyped\.logEnable\s*=/);
    expect(source).not.toMatch(/\btyped\.scanModel\s*=/);
    expect(source).not.toContain("getTriggerAdvChangeMode()");
    expect(source).not.toContain("getParkingDelay()");
    expect(source).not.toContain("modifyConfig(obj: cfgObjects)");

    expect(source).toContain("advPacket.getAdvType()");
    expect(source).toContain("cfg.setAlwaysPowerOn(alwaysPowerOn)");
    expect(source).toContain("advCfg.setSlotIndex(slotIndex)");
    expect(source).toContain("triggerCfg.setTriggerAdvTxPower(triggerTxPower)");
    expect(source).toContain("typed.setScanModel(scanModel)");
    expect(source).toContain("triggerCfg.getTriggerAdvChgMode()");
    expect(source).toContain("geoCfg.getPakingDelay()");
    expect(source).toContain("beacon.modifyConfig(array: cfgObjects)");
  });

  test("iOS SDK delegates are isolated behind an NSObject proxy", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).toContain("public class ExpoKBeaconProModule: Module {");
    expect(source).not.toContain(
      "public class ExpoKBeaconProModule: Module, KBeaconMgrDelegate",
    );
    expect(source).toContain(
      "private final class ExpoKBeaconProDelegateProxy: NSObject, KBeaconMgrDelegate, ConnStateDelegate, NotifyDataDelegate",
    );
    expect(source).toContain("private lazy var delegateProxy");
    expect(source).toContain("beaconManager?.delegate = self.delegateProxy");
    expect(source).toContain("notifyDelegate: self.delegateProxy");
    expect(source).toContain("delegate: delegateProxy");
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
    expect(source).not.toContain("object.perform(");
    expect(source).toContain("cfg.setName(name)");
    expect(source).toContain("advCfg.setAdvPeriod(advPeriod)");
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

  test("native config mappers validate present optional fields", () => {
    const androidSource = readModuleSource(
      "android/src/main/java/expo/modules/kbeaconpro/ExpoKBeaconProModule.kt",
    );
    const iosSource = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(androidSource).toContain("optionalIntegerIntValue");
    expect(androidSource).toContain("optionalFiniteFloatValue");
    expect(androidSource).toContain("optionalBooleanValue");
    expect(androidSource).toContain("optionalStringValue");
    expect(androidSource).toContain("map.containsKey(key)");

    expect(iosSource).toContain("optionalInt");
    expect(iosSource).toContain("optionalFloat");
    expect(iosSource).toContain("optionalBool");
    expect(iosSource).toContain("optionalString");
    expect(iosSource).toContain("optionalUInt8");
    expect(iosSource).toContain("dict.keys.contains(key)");
  });

  test("iOS common config validates password with isValidPassword before assignment", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");
    const commonBlock = source.slice(
      source.indexOf('case "common":'),
      source.indexOf('case "advertisement":'),
    );

    expect(commonBlock).toContain(
      'try optionalString(dict, key: "password", index: index)',
    );
    expect(commonBlock).toContain("isValidPassword(password)");
    expect(commonBlock).toContain("cfg.setPassword(password)");

    const passwordAssignmentIndex = commonBlock.indexOf(
      "cfg.setPassword(password)",
    );
    const validationIndex = commonBlock.indexOf("isValidPassword(password)");
    expect(validationIndex).toBeGreaterThan(-1);
    expect(passwordAssignmentIndex).toBeGreaterThan(validationIndex);

    expect(source).toContain(
      "private func isValidPassword(_ password: String?) -> Bool",
    );
  });

  test("iOS stopScanning cancels a deferred scan start", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");
    const stopScanningBlock = source.slice(
      source.indexOf('Function("stopScanning")'),
      source.indexOf('Function("clearBeacons")'),
    );

    expect(stopScanningBlock).toContain("pendingScanPromise?.reject");
    expect(stopScanningBlock).toContain('"SCAN_CANCELLED"');
    expect(stopScanningBlock).toContain("pendingScanPromise = nil");
    expect(stopScanningBlock).toContain("beaconManager?.stopScanning()");
  });

  test("iOS requestPermissions defers while CoreBluetooth authorization is undetermined", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");

    expect(source).toContain("private var pendingPermissionPromise: Promise?");
    expect(source).toContain("self.requestBluetoothPermission(promise)");
    expect(source).toContain("settlePendingPermissionForBluetoothState");
    expect(source).toContain(
      'bluetoothStatus != "undetermined" || state != .Unknown',
    );
    expect(source).toContain("pendingPermissionPromise?.reject");
    expect(source).not.toContain(
      "promise.resolve(self.currentPermissionStatus())",
    );
  });

  test("iOS common snapshot filters optional values before boxing", () => {
    const source = readModuleSource("ios/ExpoKBeaconProModule.swift");
    const commonBlock = source.slice(
      source.indexOf("private func commonConfigToDict"),
      source.indexOf("private func slotConfigToDict"),
    );

    expect(commonBlock).toContain("let dict: [String: Any?]");
    expect(commonBlock).toContain("filter { !isNil($0.value) }");
    expect(commonBlock).toContain("mapValues { $0 as Any }");
    expect(commonBlock).not.toContain("getName() as Any");
  });

  test("Android connection state mapping uses symbolic enum values", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/kbeaconpro/ExpoKBeaconProModule.kt",
    );

    expect(source).not.toContain("when (state.toString())");
    expect(source).toContain("when (state)");
    expect(source).toContain("KBConnState.Disconnected -> 0");
    expect(source).toContain("KBConnState.Connecting -> 1");
    expect(source).toContain("KBConnState.Connected -> 2");
    expect(source).toContain("KBConnState.Disconnecting -> 3");
  });

  test("Android permission status derives canAskAgain from denied runtime permissions", () => {
    const source = readModuleSource(
      "android/src/main/java/expo/modules/kbeaconpro/ExpoKBeaconProModule.kt",
    );

    expect(source).toContain("private var hasRequestedPermissions = false");
    expect(source).toContain("hasRequestedPermissions = true");
    expect(source).toContain("canAskAgainForDeniedPermissions");
    expect(source).toContain("ContextCompat.checkSelfPermission(context, it)");
    expect(source).toContain(
      "activity.shouldShowRequestPermissionRationale(permission)",
    );
    expect(source).not.toContain('"canAskAgain" to true');
  });
});
