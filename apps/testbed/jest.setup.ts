import { Alert } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Basic mocks for native/Expo helpers used in tests
jest.mock("expo-clipboard", () => ({
  setImageAsync: jest.fn().mockResolvedValue(undefined),
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn().mockResolvedValue("mock-base64"),
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockIcon = (props: any) => React.createElement(View, props);

  return {
    MaterialIcons: MockIcon,
  };
});

jest.mock("react-native-safe-area-context", () => {
  const SafeAreaView = ({ children }: any) => children;
  const SafeAreaProvider = ({ children }: any) => children;
  return {
    SafeAreaView,
    SafeAreaProvider,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// RN 0.81 no longer ships the legacy helper path; mock whichever path exists to silence Animated warnings
const nativeAnimatedHelperPaths = [
  "react-native/Libraries/Animated/NativeAnimatedHelper",
  "react-native/Libraries/NativeAnimated/NativeAnimatedHelper",
];

for (const helperPath of nativeAnimatedHelperPaths) {
  try {
    jest.mock(helperPath);
    break;
  } catch {
    // Ignore missing paths so tests stay compatible across RN versions
  }
}

// Provide a deterministic requestAnimationFrame for tests
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
};
(globalThis as any).cancelAnimationFrame = () => {};

jest.spyOn(Alert, "alert").mockImplementation(() => {});

// Ensure all react-test-renderer create calls are wrapped in act by default
const originalCreate = TestRenderer.create.bind(TestRenderer);
(TestRenderer as any).create = (...args: Parameters<typeof originalCreate>) => {
  let instance: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    instance = originalCreate(...args);
  });
  return instance as TestRenderer.ReactTestRenderer;
};
