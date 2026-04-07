import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text as MockText } from "react-native";
import OptimizationSubappRoute from "../optimization";

const mockSetParams = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    setParams: mockSetParams,
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock("../../../src/components/TestbedLayout", () => ({
  TestbedLayout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("../../../src/screens/OptimizationTest", () => ({
  __esModule: true,
  default: ({
    forcedViewMode,
    onRunComplete,
    onBackToConfiguration,
  }: {
    forcedViewMode?: "config" | "results";
    onRunComplete?: () => void;
    onBackToConfiguration?: () => void;
  }) => {
    return (
      <>
        <MockText testID="forced-view">{forcedViewMode}</MockText>
        <MockText testID="run-complete" onPress={onRunComplete}>
          run
        </MockText>
        <MockText testID="back-config" onPress={onBackToConfiguration}>
          back
        </MockText>
      </>
    );
  },
}));

describe("Optimization route wiring", () => {
  beforeEach(() => {
    mockSetParams.mockClear();
    mockUseLocalSearchParams.mockReset();
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it("defaults to config view when no query param is provided", () => {
    const tree = TestRenderer.create(<OptimizationSubappRoute />);
    const forcedView = tree.root.findByProps({ testID: "forced-view" });
    expect(forcedView.props.children).toBe("config");
  });

  it("maps view query param to results mode", () => {
    mockUseLocalSearchParams.mockReturnValue({ view: "results" });
    const tree = TestRenderer.create(<OptimizationSubappRoute />);
    const forcedView = tree.root.findByProps({ testID: "forced-view" });
    expect(forcedView.props.children).toBe("results");
  });

  it("wires callbacks to router setParams", () => {
    const tree = TestRenderer.create(<OptimizationSubappRoute />);
    const run = tree.root.findByProps({ testID: "run-complete" });
    const back = tree.root.findByProps({ testID: "back-config" });

    act(() => run.props.onPress());
    act(() => back.props.onPress());

    expect(mockSetParams).toHaveBeenNthCalledWith(1, { view: "results" });
    expect(mockSetParams).toHaveBeenNthCalledWith(2, { view: "config" });
  });
});
