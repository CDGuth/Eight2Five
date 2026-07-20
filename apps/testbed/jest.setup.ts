import { Alert } from "react-native";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Basic mocks for native/Expo helpers used in tests
jest.mock("expo-clipboard", () => ({
  setImageAsync: jest.fn().mockResolvedValue(undefined),
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn().mockResolvedValue("mock-base64"),
}));

const mockToastShow = jest.fn();
(globalThis as any).__TESTBED_TOAST_SHOW__ = mockToastShow;

jest.mock("@eight2five/ui/components/toast", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  return {
    Toast: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    ToastTitle: ({ children, ...props }: any) =>
      React.createElement(Text, props, children),
    ToastDescription: ({ children, ...props }: any) =>
      React.createElement(Text, props, children),
    useToast: () => ({ show: mockToastShow }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockIcon = (props: any) => React.createElement(View, props);

  return {
    MaterialIcons: MockIcon,
  };
});

jest.mock("@shopify/react-native-skia", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockSkiaNode = ({ children, testID, ...props }: any) =>
    React.createElement(View, { testID: testID ?? "skia-node", ...props }, children);

  return {
    Canvas: ({ children, testID, ...props }: any) =>
      React.createElement(
        View,
        { testID: testID ?? "skia-canvas", ...props },
        children,
      ),
    Rect: (props: any) =>
      React.createElement(View, { testID: "skia-rect", ...props }),
    Line: MockSkiaNode,
    Path: MockSkiaNode,
    Circle: MockSkiaNode,
    LinearGradient: MockSkiaNode,
    useFont: () => ({}),
    vec: (x: number, y: number) => ({ x, y }),
  };
});

jest.mock("victory-native", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    CartesianChart: ({ children, data, yKeys = [] }: any) => {
      const points = yKeys.reduce((acc: any, key: string) => {
        acc[key] = data.map((datum: any, index: number) => ({
          x: index,
          y: datum[key],
          xValue: datum.val,
          yValue: datum[key],
        }));
        return acc;
      }, {});
      return React.createElement(
        View,
        { testID: "victory-cartesian-chart" },
        typeof children === "function" ? children({ points }) : children,
      );
    },
    Line: (props: any) =>
      React.createElement(View, { testID: "victory-line", ...props }),
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

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
  mockToastShow.mockClear();
});
