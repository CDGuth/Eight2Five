import React from "react";
import { usePathname, useRouter } from "expo-router";
import { Home, Menu } from "lucide-react-native";
import { Box } from "@eight2five/ui/components/box";
import { Divider } from "@eight2five/ui/components/divider";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
} from "@eight2five/ui/components/drawer";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SUBAPPS } from "../subapps";
import {
  TestbedToolbarActionProvider,
  TestbedToolbarActionSlot,
} from "./testbed-toolbar";

const TOOLBAR_HEIGHT = 56;

export function TestbedSubappShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);
  const navigate = React.useCallback(
    (href: (typeof SUBAPPS)[number]["href"] | "/") => {
      closeDrawer();
      router.replace(href);
    },
    [closeDrawer, router],
  );

  return (
    <TestbedToolbarActionProvider>
      <Box className="flex-1" style={{ backgroundColor: theme.background }}>
        <Box
          testID="testbed-status-bar-scrim"
          style={{ height: insets.top, backgroundColor: "#000000" }}
        />
        <HStack
          testID="testbed-subapp-toolbar"
          className="w-full items-center"
          style={{
            minHeight: TOOLBAR_HEIGHT,
            paddingLeft: insets.left + eight2FiveSpacing.xs,
            paddingRight: insets.right + eight2FiveSpacing.xs,
            backgroundColor: "#000000",
          }}
        >
          <Pressable
            testID="testbed-menu-button"
            accessibilityRole="button"
            accessibilityLabel="Open subapp menu"
            onPress={() => setDrawerOpen(true)}
            className="h-11 w-11 items-center justify-center rounded-lg"
          >
            <Icon as={Menu} size="xl" color="#FFFFFF" />
          </Pressable>
          <Box className="flex-1" />
          <Box className="min-h-11 min-w-11 items-end justify-center">
            <TestbedToolbarActionSlot />
          </Box>
        </HStack>

        <Box className="flex-1">{children}</Box>

        <Drawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          closeOnOverlayClick
          isKeyboardDismissable
          anchor="left"
          size="md"
        >
          <DrawerBackdrop accessibilityLabel="Close subapp menu" />
          <DrawerContent
            style={{
              width: 288,
              maxWidth: "85%",
              padding: 0,
              paddingTop: insets.top,
              backgroundColor: theme.surfaceRaised,
            }}
          >
            <DrawerBody
              className="m-0"
              contentContainerStyle={{ padding: eight2FiveSpacing.md }}
            >
              <DrawerRow
                label="Home"
                icon={Home}
                selected={pathname === "/"}
                onPress={() => navigate("/")}
              />
              <Divider
                testID="testbed-drawer-divider"
                className="my-3 w-full"
                style={{ backgroundColor: theme.border }}
              />
              {SUBAPPS.map((subapp) => (
                <DrawerRow
                  key={subapp.id}
                  label={subapp.title}
                  selected={pathname.includes(`/${subapp.id}`)}
                  onPress={() => navigate(subapp.href)}
                />
              ))}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Box>
    </TestbedToolbarActionProvider>
  );
}

function DrawerRow({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: React.ComponentType;
  selected: boolean;
  onPress(): void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Pressable
      testID={`testbed-drawer-${label.toLowerCase().replaceAll(" ", "-")}`}
      accessibilityRole="button"
      accessibilityLabel={label === "Home" ? "Go to Home" : `Open ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-11 w-full flex-row items-center rounded-lg px-3"
      style={{
        gap: eight2FiveSpacing.sm,
        backgroundColor: selected ? theme.accentSoft : "transparent",
      }}
    >
      {icon ? <Icon as={icon} size="lg" color={theme.icon} /> : null}
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          color: theme.text,
          fontFamily: selected
            ? eight2FiveFonts.utilitySemibold
            : eight2FiveFonts.utilityRegular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
