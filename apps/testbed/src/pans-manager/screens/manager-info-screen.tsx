import React from "react";
import { Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Copy } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Divider } from "@eight2five/ui/components/divider";
import { HStack } from "@eight2five/ui/components/hstack";
import { SafeAreaView } from "@eight2five/ui/components/safe-area-view";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import expoPackage from "expo/package.json";
import pansBleApiPackage from "../../../../../modules/expo-pans-ble-api/package.json";
import mobilePackage from "../../../../../packages/mobile/package.json";
import uiPackage from "../../../../../packages/ui/package.json";

import { useManagerDiagnostics, useManagerReadiness } from "../manager-context";
import type {
  ManagerPermissionStatus,
  ManagerStepStatus,
} from "../manager-context";
import type { PansDiscoveryDiagnostics } from "@eight2five/mobile/pans-manager";
import { displayError } from "../manager-utils";

declare const __DEV__: boolean;

const UNAVAILABLE = "Unavailable";
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

interface InfoRow {
  label: string;
  value: string;
}

interface InfoSection {
  title: string;
  rows: InfoRow[];
}

interface ManagerContextSlice {
  moduleStatus: ManagerStepStatus;
  storageStatus: ManagerStepStatus;
  permission?: ManagerPermissionStatus;
  discoveryDiagnostics?: PansDiscoveryDiagnostics;
}

export function ManagerInfoScreen() {
  const theme = useEight2FiveTheme();
  const { moduleStatus, storageStatus, permission } = useManagerReadiness();
  const discoveryDiagnostics = useManagerDiagnostics();
  const [feedback, setFeedback] = React.useState<{
    tone: "success" | "error";
    message: string;
  }>();
  const sections = buildInfoSections({
    moduleStatus,
    storageStatus,
    permission,
    discoveryDiagnostics,
  });
  const rows = sections.flatMap((section) => section.rows);

  const copySummary = async () => {
    try {
      await Clipboard.setStringAsync(buildDiagnosticSummary(sections));
      setFeedback({ tone: "success", message: "Diagnostic summary copied." });
    } catch (error) {
      setFeedback({ tone: "error", message: displayError(error) });
    }
  };

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView
        testID="manager-info-screen"
        contentContainerStyle={{
          paddingHorizontal: eight2FiveSpacing.md,
          paddingTop: eight2FiveSpacing.sm,
          paddingBottom: eight2FiveSpacing.xxl,
        }}
      >
        <VStack className="w-full">
          {rows.map((row, index) => (
            <React.Fragment key={row.label}>
              {index > 0 ? (
                <Divider style={{ backgroundColor: theme.border }} />
              ) : null}
              <HStack
                className="w-full min-h-11 items-center justify-between"
                style={{
                  gap: eight2FiveSpacing.md,
                  paddingVertical: eight2FiveSpacing.sm,
                }}
              >
                <Text size="sm" style={{ color: theme.textMuted }}>
                  {row.label}
                </Text>
                <Text
                  selectable
                  size="sm"
                  className="shrink text-right"
                  style={{
                    color: theme.text,
                    fontFamily: eight2FiveFonts.utilitySemibold,
                  }}
                >
                  {row.value}
                </Text>
              </HStack>
            </React.Fragment>
          ))}
        </VStack>
        <Button
          testID="copy-diagnostic-summary"
          className="mt-4 min-h-12 rounded-xl px-5"
          style={{ backgroundColor: theme.accent, borderWidth: 0 }}
          onPress={() => void copySummary()}
        >
          <ButtonIcon as={Copy} style={{ color: theme.raw.white }} />
          <ButtonText style={{ color: theme.raw.white }}>
            Copy diagnostic summary
          </ButtonText>
        </Button>
        {feedback ? (
          <Text
            selectable
            size="sm"
            accessibilityLiveRegion="polite"
            style={{
              marginTop: eight2FiveSpacing.xs,
              color: feedback.tone === "error" ? theme.danger : theme.success,
            }}
          >
            {feedback.message}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildInfoSections(manager: ManagerContextSlice): InfoSection[] {
  const config = Constants.expoConfig;
  const buildId =
    typeof config?.extra?.buildId === "string"
      ? config.extra.buildId
      : undefined;
  const runtimeVersion =
    typeof config?.runtimeVersion === "string"
      ? config.runtimeVersion
      : undefined;
  const updateId = Updates.updateId ?? undefined;
  const channel = Updates.channel ?? undefined;

  const buildRows: InfoRow[] = [
    { label: "App name", value: config?.name ?? UNAVAILABLE },
    { label: "App version", value: config?.version ?? UNAVAILABLE },
  ];
  if (Platform.OS === "ios") {
    buildRows.push({
      label: "iOS build number",
      value: config?.ios?.buildNumber ?? UNAVAILABLE,
    });
  } else if (Platform.OS === "android") {
    buildRows.push({
      label: "Android version code",
      value:
        config?.android?.versionCode != null
          ? String(config.android.versionCode)
          : UNAVAILABLE,
    });
  } else {
    buildRows.push({
      label: "Build number",
      value:
        config?.ios?.buildNumber ??
        (config?.android?.versionCode != null
          ? String(config.android.versionCode)
          : UNAVAILABLE),
    });
  }
  buildRows.push(
    { label: "Build ID", value: buildId ?? UNAVAILABLE },
    {
      label: "Git commit",
      value:
        buildId && GIT_SHA_PATTERN.test(buildId)
          ? buildId
          : "Unavailable (local build)",
    },
    { label: "Runtime version", value: runtimeVersion ?? UNAVAILABLE },
    {
      label: "EAS update ID",
      value:
        updateId ??
        (Updates.isEmbeddedLaunch
          ? "Unavailable (embedded launch)"
          : UNAVAILABLE),
    },
    { label: "Update channel", value: channel ?? UNAVAILABLE },
    {
      label: "Environment",
      value: __DEV__ ? "development" : (channel ?? "production"),
    },
  );

  const runtimeRows: InfoRow[] = [
    { label: "Expo SDK", value: expoPackage.version ?? UNAVAILABLE },
    {
      label: "React Native",
      value: formatReactNativeVersion(),
    },
    { label: "Platform", value: Platform.OS },
    { label: "OS version", value: String(Platform.Version) },
    {
      label: "PANS module build ID",
      value: manager.discoveryDiagnostics?.buildId ?? UNAVAILABLE,
    },
    { label: "Native module status", value: manager.moduleStatus },
    {
      label: "Bluetooth permission",
      value: manager.permission?.bluetooth ?? UNAVAILABLE,
    },
    {
      label: "Bluetooth adapter",
      value: manager.discoveryDiagnostics?.state ?? UNAVAILABLE,
    },
    { label: "Storage status", value: manager.storageStatus },
  ];

  const packageRows: InfoRow[] = [
    {
      label: "expo-pans-ble-api",
      value: pansBleApiPackage.version ?? UNAVAILABLE,
    },
    {
      label: "@eight2five/mobile",
      value: mobilePackage.version ?? UNAVAILABLE,
    },
    { label: "@eight2five/ui", value: uiPackage.version ?? UNAVAILABLE },
  ];

  return [
    { title: "Build information", rows: buildRows },
    { title: "Runtime information", rows: runtimeRows },
    { title: "Package information", rows: packageRows },
  ];
}

function formatReactNativeVersion(): string {
  const { major, minor, patch, prerelease } =
    Platform.constants.reactNativeVersion;
  return `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ""}`;
}

function buildDiagnosticSummary(sections: InfoSection[]): string {
  return sections
    .map((section) =>
      [
        `${section.title}:`,
        ...section.rows.map((row) => `${row.label}: ${row.value}`),
      ].join("\n"),
    )
    .join("\n\n");
}
