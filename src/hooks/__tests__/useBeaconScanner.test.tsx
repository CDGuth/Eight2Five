import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useBeaconScanner } from "../useBeaconScanner";
import { APP_NAMESPACE, BeaconState } from "../../types/BeaconProtocol";
import {
  startScanning,
  stopScanning,
  addBeaconDiscoveredListener,
} from "../../../modules/expo-kbeaconpro/src/ExpoKBeaconProModule";

let mockListener: ((event: { beacons: any[] }) => void) | null = null;

jest.mock("../../../modules/expo-kbeaconpro/src/ExpoKBeaconProModule", () => {
  const startScanning = jest.fn();
  const stopScanning = jest.fn();
  const addBeaconDiscoveredListener = jest.fn((listener: any) => {
    mockListener = listener;
    return { remove: jest.fn() };
  });

  return {
    startScanning,
    stopScanning,
    addBeaconDiscoveredListener,
  };
});

const MAX_UINT32 = 4294967295;

function asciiToHex(str: string): string {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return "0x" + hex.toUpperCase();
}

function encodePercent(percent: number): number {
  return Math.round((percent / 100) * MAX_UINT32);
}

function numberToHex(value: number, bytes: number): string {
  return (value >>> 0).toString(16).padStart(bytes * 2, "0");
}

function buildIdentityPacket(flags: number, txPower: number) {
  const sidBytes = [0x01, flags, txPower & 0xff, 0x00, 0x00, 0x00];
  return {
    nid: asciiToHex(APP_NAMESPACE),
    sid: "0x" + sidBytes.map((b) => b.toString(16).padStart(2, "0")).join(""),
  };
}

function buildPositionPacket(xPercent: number, yPercent: number, zCm: number) {
  const xHex = numberToHex(encodePercent(xPercent), 4);
  const yHex = numberToHex(encodePercent(yPercent), 4);
  const zHex = ((zCm < 0 ? zCm & 0xffff : zCm) & 0xffff)
    .toString(16)
    .padStart(4, "0");
  return {
    nid: "0x" + xHex + yHex + zHex,
    sid: "0x020000000000",
  };
}

type RenderCallback = (map: Map<string, BeaconState>) => void;

function TestHarness({ onRender }: { onRender: RenderCallback }) {
  const { beacons } = useBeaconScanner();

  useEffect(() => {
    onRender(beacons);
  }, [beacons, onRender]);

  return null;
}

describe("useBeaconScanner", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockListener = null;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("starts scanning on mount and stops on unmount", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<TestHarness onRender={() => {}} />);
    });

    expect(startScanning).toHaveBeenCalledTimes(1);
    expect(addBeaconDiscoveredListener).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer!.unmount();
    });
    expect(stopScanning).toHaveBeenCalledTimes(1);
  });

  it("updates beacon map when discovery events fire", async () => {
    let latestMap: Map<string, BeaconState> = new Map();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <TestHarness
          onRender={(map) => {
            latestMap = map;
          }}
        />,
      );
    });

    expect(mockListener).toBeTruthy();

    const identity = buildIdentityPacket(0x07, -60);
    const position = buildPositionPacket(10, 90, 123);

    await act(async () => {
      mockListener?.({
        beacons: [
          {
            mac: "AA:BB:CC:DD:EE:FF",
            rssi: -65,
            advPackets: [
              { advType: 2, ...identity },
              { advType: 2, ...position },
            ],
          },
        ],
      });
    });

    const entry = latestMap.get("AA:BB:CC:DD:EE:FF");
    expect(entry).toBeDefined();
    expect(entry?.identity?.flags.isConfigured).toBe(true);
    expect(entry?.position?.xPercent).toBeCloseTo(10, 5);
    expect(entry?.position?.yPercent).toBeCloseTo(90, 5);
    expect(entry?.position?.zCm).toBe(123);

    await act(async () => {
      renderer!.unmount();
    });
  });
});
