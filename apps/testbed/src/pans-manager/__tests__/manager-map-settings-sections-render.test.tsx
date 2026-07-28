import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  CameraSettingsSection,
  LiveDiagnosticsSettingsSection,
} from "../components/manager-map-settings-modal";

jest.mock("expo-pans-ble-api", () => ({}));

const mockHeadingRenders = jest.fn();

jest.mock("@eight2five/ui/components/heading", () => ({
  Heading: ({ children }: { children?: React.ReactNode }) => {
    mockHeadingRenders(children);
    return children;
  },
}));

const cameraActions = {
  fitVisible: jest.fn(),
  fitAnchors: jest.fn(),
  resetCamera: jest.fn(),
};
const counters = {
  notificationEvents: 1,
  matchingDeviceNotifications: 1,
  filteredDeviceNotifications: 0,
  decodedFrames: 1,
  positionFrames: 1,
  distanceFrames: 0,
  diagnosticFrames: 0,
  emittedSamples: 1,
  mapPositionUpdates: 1,
  decodeFailures: 0,
  nativeSequenceDiscontinuities: 0,
};

function Sections({ updates = 1 }) {
  return (
    <>
      <CameraSettingsSection {...cameraActions} />
      <LiveDiagnosticsSettingsSection
        counters={{ ...counters, mapPositionUpdates: updates }}
      />
    </>
  );
}

test("live counter updates do not rerender the camera section", async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Sections />);
  });
  mockHeadingRenders.mockClear();
  await act(async () => {
    tree.update(<Sections updates={2} />);
  });
  expect(mockHeadingRenders).toHaveBeenCalledWith("Live pipeline");
  expect(mockHeadingRenders).not.toHaveBeenCalledWith("Camera");
  await act(async () => tree.unmount());
});
