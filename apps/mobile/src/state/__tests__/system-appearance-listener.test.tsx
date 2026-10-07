import React from "react";
import { Appearance, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import {
  Eight2FiveThemeProvider,
  useEight2FiveThemeName,
} from "@eight2five/ui/theme";

describe("system appearance synchronization", () => {
  afterEach(() => jest.restoreAllMocks());

  test("updates the resolved theme when the OS appearance changes", async () => {
    let listener:
      | ((event: { colorScheme: "light" | "dark" | null }) => void)
      | undefined;
    const remove = jest.fn();
    let currentScheme: "light" | "dark" | null = "light";
    jest
      .spyOn(Appearance, "getColorScheme")
      .mockImplementation(() => currentScheme);
    jest
      .spyOn(Appearance, "addChangeListener")
      .mockImplementation((nextListener) => {
        listener = nextListener as typeof listener;
        return { remove } as never;
      });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <Eight2FiveThemeProvider mode="system">
          <ThemeNameProbe />
        </Eight2FiveThemeProvider>,
      );
    });
    expect(renderer.root.findByType(Text).props.children).toBe("light");

    currentScheme = "dark";
    await act(async () => {
      listener?.({ colorScheme: "dark" });
    });
    expect(renderer.root.findByType(Text).props.children).toBe("dark");

    await act(async () => renderer.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test("keeps the standalone theme hook reactive without a provider", async () => {
    let listener:
      | ((event: { colorScheme: "light" | "dark" | null }) => void)
      | undefined;
    const remove = jest.fn();
    let currentScheme: "light" | "dark" | null = "light";
    jest
      .spyOn(Appearance, "getColorScheme")
      .mockImplementation(() => currentScheme);
    jest
      .spyOn(Appearance, "addChangeListener")
      .mockImplementation((nextListener) => {
        listener = nextListener as typeof listener;
        return { remove } as never;
      });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ThemeNameProbe />);
    });
    expect(renderer.root.findByType(Text).props.children).toBe("light");

    currentScheme = "dark";
    await act(async () => {
      listener?.({ colorScheme: "dark" });
    });
    expect(renderer.root.findByType(Text).props.children).toBe("dark");

    await act(async () => renderer.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

function ThemeNameProbe() {
  return <Text>{useEight2FiveThemeName()}</Text>;
}
