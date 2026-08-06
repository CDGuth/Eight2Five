import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  type ManagedNetwork,
} from "@eight2five/mobile/pans-manager";

import { networkDraftFromNetwork, validateNetworkDraft } from "../network-form";

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets/lib/module/mock"),
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock("react-native-reanimated", () =>
  jest.requireActual("react-native-reanimated/mock"),
);
jest.mock(
  "@shopify/react-native-skia",
  () => ({
    Canvas: () => null,
    Fill: () => null,
    Group: () => null,
    Path: () => null,
    Circle: () => null,
    Line: () => null,
    Rect: () => null,
    useFont: () => ({}),
    vec: (x: number, y: number) => ({ x, y }),
  }),
  { virtual: true },
);

describe("mobile network profile validation", () => {
  test("accepts trimmed names and hexadecimal PAN IDs", () => {
    const result = validateNetworkDraft({
      name: "  Stadium  ",
      panId: "0x00a0",
    });

    expect(result).toEqual({
      errors: {},
      value: { name: "Stadium", panId: 160 },
    });
  });

  test("rejects an empty name, reserved PAN 0, and duplicate PAN IDs", () => {
    const networks = [network("existing", "Existing", 160)];

    expect(validateNetworkDraft({ name: " ", panId: "0" }, networks)).toEqual({
      errors: {
        name: "Enter a network name.",
        panId:
          "Saved network PAN ID must be an integer from 1 to 65535; PAN 0 is the PANS default used for unassigned devices.",
      },
    });
    expect(
      validateNetworkDraft({ name: "Other", panId: "160" }, networks).errors,
    ).toEqual({ panId: "A network with this PAN ID already exists." });
  });

  test("rejects duplicate names without blocking the network being edited", () => {
    const existing = network("existing", "Field", 160);
    const other = network("other", "Auxiliary", 161);

    expect(
      validateNetworkDraft(
        { name: " field ", panId: "0x00a2" },
        [existing, other],
        existing.id,
      ),
    ).toEqual({ errors: {}, value: { name: "field", panId: 162 } });
    expect(
      validateNetworkDraft({ name: "FIELD", panId: "162" }, [existing, other])
        .errors,
    ).toEqual({ name: "A network with this name already exists." });
  });

  test("round-trips the detail form draft", () => {
    expect(networkDraftFromNetwork(network("one", "One", 42))).toEqual({
      name: "One",
      panId: "42",
    });
  });
});

function network(id: string, name: string, panId: number): ManagedNetwork {
  return {
    id,
    name,
    panId,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
    createdAt: 1,
    updatedAt: 1,
  };
}
