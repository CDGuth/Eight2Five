import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  AvailabilitySettingsSection,
  CoordinateSystemSettingsSection,
  IdentitySettingsSection,
} from "../components/network-settings-sections";

jest.mock("expo-pans-ble-api", () => ({}));

const mockSectionRenders = jest.fn();
const MockReact = React;

jest.mock("../components/manager-ui", () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => children;
  return {
    KeyValue: Wrapper,
    ManagerButton: Wrapper,
    SelectField: Wrapper,
    StatePanel: Wrapper,
    SwitchField: Wrapper,
    TextField: Wrapper,
    SectionCard: ({
      title,
      children,
    }: {
      title: string;
      children?: React.ReactNode;
    }) => {
      mockSectionRenders(title);
      return MockReact.createElement(MockReact.Fragment, null, children);
    },
  };
});
jest.mock("../components/setting-help", () => ({
  SettingHelp: ({ children }: { children?: React.ReactNode }) => children,
}));

const noop = jest.fn();

function Sections({ name = "Network", minX = "0", stale = "5" }) {
  return (
    <>
      <IdentitySettingsSection
        name={name}
        notes=""
        panId={1}
        onNameChange={noop}
        onNotesChange={noop}
        onSave={noop}
      />
      <CoordinateSystemSettingsSection
        mapUnits="metric"
        mapAreaMode="bounded"
        minX={minX}
        maxX="10"
        minY="0"
        maxY="10"
        minZ="0"
        maxZ="3"
        anchorHeight="2"
        onMapUnitsChange={noop}
        setField={noop}
      />
      <AvailabilitySettingsSection
        staleTimeout={stale}
        autoConnect
        setField={noop}
      />
    </>
  );
}

describe("network settings section render isolation", () => {
  test("coordinate typing does not rerender identity or availability", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<Sections />);
    });
    mockSectionRenders.mockClear();
    await act(async () => {
      tree.update(<Sections minX="1" />);
    });
    expect(mockSectionRenders.mock.calls.map(([title]) => title)).toEqual([
      "Map and coordinate system",
    ]);
    await act(async () => tree.unmount());
  });

  test("identity typing does not rerender coordinate or availability", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<Sections />);
    });
    mockSectionRenders.mockClear();
    await act(async () => {
      tree.update(<Sections name="Renamed" />);
    });
    expect(mockSectionRenders.mock.calls.map(([title]) => title)).toEqual([
      "Identity",
      "PANS Network ID",
    ]);
    await act(async () => tree.unmount());
  });
});
