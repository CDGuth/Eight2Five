import { createNetworkDeviceDragEvent } from "../components/network-device-drag";

describe("network device drag geometry", () => {
  test("fixes preview X and width to the measured source while Y follows", () => {
    const bounds = { left: 20, top: 30, width: 240, height: 80 };

    expect(createNetworkDeviceDragEvent("device", 70, bounds)).toEqual({
      deviceKey: "device",
      x: 140,
      y: 70,
      sourceLeft: 20,
      sourceTop: 30,
      sourceWidth: 240,
      sourceHeight: 80,
    });
    expect(createNetworkDeviceDragEvent("device", 210, bounds, false)).toEqual(
      expect.objectContaining({
        x: 140,
        y: 210,
        sourceLeft: 20,
        sourceWidth: 240,
        cancelled: false,
      }),
    );
  });
});
