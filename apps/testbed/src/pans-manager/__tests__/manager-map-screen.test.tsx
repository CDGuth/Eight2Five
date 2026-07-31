import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Settings2 } from "lucide-react-native";
import { PansNetworkGrid } from "@eight2five/mobile/pans-manager";
import { ButtonIcon } from "@eight2five/ui/components/button";
import { Checkbox } from "@eight2five/ui/components/checkbox";
import { Switch } from "@eight2five/ui/components/switch";

import type { PansMapDataController } from "../manager-map-controller";
import { SelectField } from "../components/manager-ui";
import { ManagerMapScreen } from "../screens/manager-map-screen";
import { ManagerMapSettingsModal } from "../components/manager-map-settings-modal";
import {
  TestbedToolbarActionProvider,
  TestbedToolbarActionSlot,
} from "../../components/testbed-toolbar";

let mockController: PansMapDataController;

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("@eight2five/ui/components/modal", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  const { View: MockView } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Wrapper = ({ children, ...props }: any) =>
    MockReact.createElement(MockView, props, children);
  return {
    Modal: ({ isOpen, children, ...props }: any) =>
      MockReact.createElement(
        MockView,
        { ...props, isOpen },
        isOpen ? children : null,
      ),
    ModalBackdrop: Wrapper,
    ModalBody: Wrapper,
    ModalCloseButton: Wrapper,
    ModalContent: Wrapper,
    ModalFooter: Wrapper,
    ModalHeader: Wrapper,
  };
});
jest.mock("expo-router", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      MockReact.useEffect(callback, [callback]),
  };
});
jest.mock("../manager-map-controller", () => ({
  usePansMapDataController: () => mockController,
}));

describe("ManagerMapScreen", () => {
  beforeEach(() => {
    mockController = controllerFixture();
  });

  test("fills the route, maps the theme palette, and uses the Settings2 icon wrapper", async () => {
    const tree = await renderScreen();
    const root = tree.root.findByProps({ testID: "manager-map-screen" });
    expect(root.props.style).toMatchObject({ flex: 1 });
    const grid = tree.root.findByType(PansNetworkGrid);
    expect(grid.props.style).toEqual({ flex: 1 });
    expect(grid.props.labelFontFamily).toBe("SourceSans3_400Regular");
    expect(Object.keys(grid.props.palette).sort()).toEqual(
      [
        "background",
        "grid",
        "anchor",
        "tag",
        "initiator",
        "selected",
        "offline",
        "warning",
        "error",
        "label",
        "edge",
      ].sort(),
    );
    expect(
      tree.root
        .findAllByType(ButtonIcon)
        .some((icon) => icon.props.as === Settings2),
    ).toBe(true);
    expect(mockController.startDirectTracking).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  test("keeps local modal state through a rerender and exposes network and visibility actions", async () => {
    const tree = await renderScreen();
    expect(tree.root.findAllByType(ManagerMapSettingsModal)).toHaveLength(0);
    act(() =>
      tree.root
        .findByProps({ testID: "manager-map-settings-button" })
        .props.onPress(),
    );
    expect(
      tree.root.findByProps({ testID: "manager-map-settings-modal-root" }).props
        .isOpen,
    ).toBe(true);
    expect(
      mockController.setTrackingDiagnosticsVisible,
    ).toHaveBeenLastCalledWith(true);
    expect(tree.root.findAllByType(ManagerMapSettingsModal)).toHaveLength(1);

    await act(async () => tree.update(mapScreenElement()));
    expect(
      tree.root.findByProps({ testID: "manager-map-settings-modal-root" }).props
        .isOpen,
    ).toBe(true);
    act(() =>
      tree.root
        .findByProps({ testID: "map-networks-select-all" })
        .props.onPress(),
    );
    expect(mockController.selectAllNetworks).toHaveBeenCalledTimes(1);
    const networkCheckbox = tree.root
      .findAllByType(Checkbox)
      .find((checkbox) => checkbox.props.value === "network");
    act(() => networkCheckbox?.props.onChange(false));
    expect(mockController.setNetworkVisible).toHaveBeenCalledWith(
      "network",
      false,
    );
    const anchorSwitch = tree.root
      .findAllByType(Switch)
      .find((item) => item.props.testID === "map-switch-anchors");
    act(() => anchorSwitch?.props.onValueChange(false));
    expect(mockController.setVisibility).toHaveBeenCalledWith("anchors", false);
    expect(
      findText(
        tree,
        "Multiple networks are overlaid using their saved coordinates. The app does not automatically align independent coordinate systems.",
      ),
    ).toBe(true);
    act(() =>
      tree.root
        .findByProps({ testID: "manager-map-settings-modal-root" })
        .props.onClose(),
    );
    expect(tree.root.findAllByType(ManagerMapSettingsModal)).toHaveLength(0);
    expect(
      mockController.setTrackingDiagnosticsVisible,
    ).toHaveBeenLastCalledWith(false);
    await act(async () => tree.unmount());
  });

  test("routes map setting changes through the controller contract for all selected networks", async () => {
    const secondNetwork = {
      ...mockController.networks[0],
      id: "network-2",
      name: "Network 2",
      panId: 2,
    };
    mockController.networks = [...mockController.networks, secondNetwork];
    mockController.selectedNetworkIds = new Set(["network", "network-2"]);
    const tree = await renderScreen();

    act(() =>
      tree.root
        .findByProps({ testID: "manager-map-settings-button" })
        .props.onPress(),
    );
    expect(
      tree.root
        .findAllByType(Checkbox)
        .filter((checkbox) =>
          ["network", "network-2"].includes(checkbox.props.value),
        )
        .every((checkbox) => checkbox.props.isChecked),
    ).toBe(true);

    act(() =>
      tree.root
        .findAllByType(SelectField)
        .find((field) => field.props.testID === "map-units-select")
        ?.props.onChange("imperial"),
    );
    expect(mockController.setMapUnits).toHaveBeenCalledTimes(1);
    expect(mockController.setMapUnits).toHaveBeenCalledWith("imperial");

    act(() =>
      tree.root
        .findAllByType(SelectField)
        .find((field) => field.props.testID === "map-area-mode-select")
        ?.props.onChange("bounded"),
    );
    expect(mockController.setMapAreaMode).toHaveBeenCalledTimes(1);
    expect(mockController.setMapAreaMode).toHaveBeenCalledWith("bounded");
    expect([...mockController.selectedNetworkIds]).toEqual([
      "network",
      "network-2",
    ]);
    await act(async () => tree.unmount());
  });

  test("starts one explicit stream and submits preserved anchor edit values", async () => {
    mockController.pendingAnchorEdit = {
      anchorId: "anchor",
      coordinate: { xMeters: 4, yMeters: 5 },
      zMeters: 2,
      quality: 90,
    };
    const tree = await renderScreen();
    act(() =>
      tree.root
        .findByProps({ testID: "manager-map-settings-button" })
        .props.onPress(),
    );
    await act(async () => Promise.resolve());
    act(() =>
      tree.root.findByProps({ testID: "map-start-tracking" }).props.onPress(),
    );
    expect(mockController.startDirectTracking).toHaveBeenCalledTimes(1);
    act(() =>
      tree.root
        .findByProps({ testID: "map-write-anchor-position" })
        .props.onPress(),
    );
    expect(mockController.savePendingAnchorEdit).toHaveBeenCalledWith(2, 90);
    await act(async () => tree.unmount());
  });
});

async function renderScreen() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(mapScreenElement());
  });
  return tree;
}

function mapScreenElement() {
  return (
    <TestbedToolbarActionProvider>
      <TestbedToolbarActionSlot />
      <ManagerMapScreen />
    </TestbedToolbarActionProvider>
  );
}

function findText(tree: TestRenderer.ReactTestRenderer, value: string) {
  return tree.root
    .findAllByType("Text" as never)
    .some((node) => node.props.children === value);
}

function controllerFixture(): PansMapDataController {
  const shared = <T,>(value: T) => ({ value }) as never;
  return {
    networks: [
      {
        id: "network",
        name: "Network",
        panId: 1,
        settings: {
          mapUnits: "metric",
          mapAreaMode: "infinite",
          coordinateBounds: {
            minXMeters: -1,
            maxXMeters: 1,
            minYMeters: -1,
            maxYMeters: 1,
            minZMeters: -1,
            maxZMeters: 1,
          },
          defaultAnchorHeightMeters: 2,
          staleDeviceTimeoutMs: 10_000,
          defaultTagMode: {
            locationEngineEnabled: true,
            lowPowerModeEnabled: false,
            stationaryDetectionEnabled: true,
            locationDataMode: 0,
            movingUpdateRateMs: 100,
            stationaryUpdateRateMs: 1_000,
          },
          autoConnect: false,
          positionLogRetentionDays: 1,
          positionLogMaxSamples: 100,
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    devices: [],
    selectedNetworkIds: new Set(["network"]),
    selectAllNetworks: jest.fn(),
    clearAllNetworks: jest.fn(),
    setNetworkVisible: jest.fn(),
    visibility: {
      anchors: true,
      tags: true,
      initiators: true,
      offline: true,
      labels: true,
      panMismatchIndicators: true,
      rangingLines: true,
    },
    setVisibility: jest.fn(),
    grid: { showGrid: true, showOrigin: true },
    setGrid: jest.fn(),
    mapUnits: "metric",
    mapAreaMode: "infinite",
    selectedAreaBounds: [],
    setMapUnits: jest.fn(),
    setMapAreaMode: jest.fn(),
    gridSize: { width: 320, height: 640 },
    setGridSize: jest.fn(),
    viewport: { centerXMeters: 0, centerYMeters: 0, metersPerPixel: 0.1 },
    camera: {
      centerX: shared(0),
      centerY: shared(0),
      metersPerPixel: shared(0.1),
    },
    setViewport: jest.fn(),
    fitVisible: jest.fn(),
    fitAnchors: jest.fn(),
    resetCamera: jest.fn(),
    nodes: [],
    anchors: [],
    rangingEdges: [],
    topologyCache: {},
    refreshNetworkTopology: jest.fn(),
    setSelectedNodeId: jest.fn(),
    setSelectedAnchorId: jest.fn(),
    editableAnchors: [],
    editingEnabled: false,
    setEditingEnabled: jest.fn(),
    setPendingAnchorCoordinate: jest.fn(),
    cancelPendingAnchorEdit: jest.fn(),
    savePendingAnchorEdit: jest.fn(),
    trackingStatus: "stopped",
    trackingSource: "none",
    setTrackingDiagnosticsVisible: jest.fn(),
    selectedDirectTagId: "tag",
    setSelectedDirectTagId: jest.fn(),
    trackableTags: [],
    follow: false,
    setFollow: jest.fn(),
    retainLastKnown: true,
    setRetainLastKnown: jest.fn(),
    lastKnownTagPositions: {},
    clearLastKnown: jest.fn(),
    startDirectTracking: jest.fn(),
    stopTracking: jest.fn(),
    proxyStatus: "unavailable",
    proxyMessage: "Proxy tracking is unavailable.",
  };
}
