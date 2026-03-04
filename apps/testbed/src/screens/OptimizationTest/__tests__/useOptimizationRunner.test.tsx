import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useOptimizationRunner } from "../hooks/useOptimizationRunner";

const mockSolve = jest.fn(async ({ anchors, initialPopulation }) => ({
  x: anchors?.[0]?.x ?? 0,
  y: anchors?.[0]?.y ?? 0,
  errorRmse: 0.25,
  iterations: 3,
  diagnostics: {
    initialPopulation: initialPopulation || [],
    finalPopulation: [{ x: 1, y: 1 }],
  },
}));

jest.mock("@eight2five/shared/localization/algorithms/MFASA", () => ({
  MFASAOptimizer: jest.fn().mockImplementation(() => ({
    solve: mockSolve,
    cancel: jest.fn(),
  })),
}));

jest.mock("@eight2five/shared/localization/models/TwoRayGroundModel", () => ({
  TwoRayGroundModel: jest.fn().mockImplementation(() => ({
    estimateRssi: ({ distanceMeters }: { distanceMeters: number }) =>
      -50 - distanceMeters * 0.5,
  })),
}));

jest.mock("@eight2five/shared/localization/models/LogNormalModel", () => ({
  LogNormalModel: jest.fn().mockImplementation(() => ({
    estimateRssi: ({ distanceMeters }: { distanceMeters: number }) =>
      -55 - distanceMeters * 0.25,
  })),
}));

jest.mock("@eight2five/shared/localization/filters/KalmanFilter", () => ({
  KalmanFilter: jest.fn().mockImplementation(() => ({
    filterSample: (v: number) => v,
  })),
}));

jest.setTimeout(15000);

describe("useOptimizationRunner", () => {
  let randomSpy: jest.SpyInstance<number, []>;
  let performanceSpy: jest.SpyInstance<number, []>;

  const renderHook = () => {
    let hook: ReturnType<typeof useOptimizationRunner> | null = null;
    const Wrapper = () => {
      hook = useOptimizationRunner();
      return null;
    };

    act(() => {
      TestRenderer.create(<Wrapper />);
    });

    if (!hook) throw new Error("Hook did not render");

    return {
      get state() {
        if (!hook) throw new Error("Hook not ready");
        return hook.state;
      },
      get actions() {
        if (!hook) throw new Error("Hook not ready");
        return hook.actions;
      },
      get setters() {
        if (!hook) throw new Error("Hook not ready");
        return hook.setters;
      },
    };
  };

  beforeEach(() => {
    mockSolve.mockClear();
    randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.42);
    let now = 0;
    performanceSpy = jest
      .spyOn(performance, "now")
      .mockImplementation(() => (now += 5));
  });

  afterEach(() => {
    randomSpy.mockRestore();
    performanceSpy.mockRestore();
    jest.clearAllMocks();
  });

  it("runs a standard test and computes batch analysis", async () => {
    const hook = renderHook();

    await act(async () => {
      hook.actions.generateAnchors();
      hook.actions.generateFireflies();
    });

    await act(async () => hook.setters.setNumRuns("2"));

    await act(async () => {
      await hook.actions.runOptimizationTest();
    });

    await act(async () => {});

    expect(mockSolve).toHaveBeenCalled();
    expect(hook.state.viewMode).toBe("results");
    expect(hook.state.progress).toBeCloseTo(1);
    expect(hook.state.isRunning).toBe(false);
  });

  it("supports cancelling a run early", async () => {
    const hook = renderHook();

    await act(() => {
      hook.setters.setNumRuns("4");
    });

    const runPromise = act(async () => {
      await hook.actions.runOptimizationTest();
    });

    hook.actions.cancelTest();
    await runPromise;

    expect(hook.state.results.length).toBeLessThan(4);
    expect(hook.state.isRunning).toBe(false);
  });

  it("executes sweep mode and captures sweep results", async () => {
    const hook = renderHook();

    await act(async () => {
      hook.setters.setTestMode("sweep");
      hook.setters.setSweepConfig({
        param: "populationSize",
        min: "2",
        max: "2",
        step: "1",
        runsPerStep: "1",
      });
      hook.actions.generateAnchors();
      hook.actions.generateFireflies();
    });

    await act(async () => {
      await hook.actions.runOptimizationTest();
    });

    await act(async () => {});

    expect(mockSolve).toHaveBeenCalled();
    expect(hook.state.viewMode).toBe("results");
    expect(hook.state.progress).toBeGreaterThan(0);
  });
});
