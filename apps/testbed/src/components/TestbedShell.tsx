import React from "react";
import { Box } from "@eight2five/ui/components/box";
import { HStack } from "@eight2five/ui/components/hstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  TestbedToolbarActionProvider,
  TestbedToolbarActionSlot,
} from "./testbed-toolbar";

const TOOLBAR_HEIGHT = 56;

export function TestbedShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const theme = useEight2FiveTheme();

  return (
    <TestbedToolbarActionProvider>
      <Box className="flex-1" style={{ backgroundColor: theme.background }}>
        <Box
          testID="testbed-status-bar-scrim"
          style={{ height: insets.top, backgroundColor: "#000000" }}
        />
        <HStack
          testID="testbed-toolbar"
          className="w-full items-center"
          style={{
            minHeight: TOOLBAR_HEIGHT,
            paddingLeft: insets.left + eight2FiveSpacing.xs,
            paddingRight: insets.right + eight2FiveSpacing.xs,
            backgroundColor: "#000000",
          }}
        >
          <Box className="flex-1" />
          <Box className="min-h-11 min-w-11 items-end justify-center">
            <TestbedToolbarActionSlot />
          </Box>
        </HStack>
        <Box className="flex-1">{children}</Box>
      </Box>
    </TestbedToolbarActionProvider>
  );
}
