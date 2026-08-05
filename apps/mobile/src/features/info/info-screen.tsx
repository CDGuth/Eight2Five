import React from "react";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { Linking, Platform } from "react-native";
import { Card } from "@eight2five/ui/components/card";
import { Divider } from "@eight2five/ui/components/divider";
import { HStack } from "@eight2five/ui/components/hstack";
import { Image } from "@eight2five/ui/components/image";
import { Pressable } from "@eight2five/ui/components/pressable";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
  useEight2FiveThemeName,
} from "@eight2five/ui/theme";

import {
  EIGHT2FIVE_GITHUB_URL,
  EIGHT2FIVE_LICENSE_URL,
  getMobileInfoMetadata,
} from "./info-metadata";

const INFO_SPLASH_ASSET_SOURCES = {
  ios: {
    light: require("../../../assets/splash-icons/mobile-ios-splash-icon-light.png"),
    dark: require("../../../assets/splash-icons/mobile-ios-splash-icon-dark.png"),
  },
  android: {
    light: require("../../../assets/splash-icons/mobile-ios-splash-icon-light.png"),
    dark: require("../../../assets/splash-icons/mobile-ios-splash-icon-dark.png"),
  },
} as const;

export function InfoScreen() {
  const theme = useEight2FiveTheme();
  const themeName = useEight2FiveThemeName();
  const metadata = getMobileInfoMetadata(
    Constants.expoConfig,
    Platform.OS,
    Application.nativeBuildVersion,
  );
  const platform = Platform.OS === "android" ? "android" : "ios";
  const splashSource = INFO_SPLASH_ASSET_SOURCES[platform][themeName];

  return (
    <ScrollView
      testID="info-screen"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{
        alignItems: "center",
        gap: eight2FiveSpacing.lg,
        paddingHorizontal: eight2FiveSpacing.md,
        paddingTop: eight2FiveSpacing.lg,
        paddingBottom: eight2FiveSpacing.xxl,
      }}
    >
      <VStack className="w-full items-center" style={{ gap: 2 }}>
        <Image
          testID="info-splash-icon"
          size="none"
          source={splashSource}
          resizeMode="contain"
          accessibilityLabel={`${metadata.appName} logo`}
          style={{ height: 160, width: 160 }}
        />
        <Text
          selectable
          size="xl"
          style={{
            color: theme.text,
            fontFamily: eight2FiveFonts.styleBold,
          }}
        >
          {metadata.appName}
        </Text>
      </VStack>

      <Card
        className="w-full p-0"
        style={{
          overflow: "hidden",
          borderWidth: 0,
          borderRadius: eight2FiveRadii.md,
          backgroundColor: theme.surfaceRaised,
        }}
      >
        <InfoRow label="Version" value={metadata.version} />
        <Divider style={{ backgroundColor: theme.border }} />
        <InfoRow
          label={metadata.nativeBuildLabel}
          value={metadata.nativeBuildValue}
        />
        <Divider style={{ backgroundColor: theme.border }} />
        <InfoRow label="Git SHA" value={metadata.gitSha} />
      </Card>

      <VStack className="w-full items-center" style={{ gap: 4 }}>
        <ExternalLink
          testID="info-license-link"
          label="MIT License"
          url={EIGHT2FIVE_LICENSE_URL}
        />
        <ExternalLink
          testID="info-github-link"
          label="GitHub"
          url={EIGHT2FIVE_GITHUB_URL}
        />
      </VStack>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useEight2FiveTheme();

  return (
    <HStack
      className="w-full min-h-14 items-center justify-between"
      style={{ gap: eight2FiveSpacing.md, padding: eight2FiveSpacing.md }}
    >
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
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
        {value}
      </Text>
    </HStack>
  );
}

function ExternalLink({
  label,
  testID,
  url,
}: {
  label: string;
  testID: string;
  url: string;
}) {
  const theme = useEight2FiveTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="Opens in your browser"
      onPress={() => void Linking.openURL(url)}
      style={{ padding: eight2FiveSpacing.xs }}
    >
      <Text
        style={{
          color: theme.accent,
          fontFamily: eight2FiveFonts.utilitySemibold,
          textDecorationLine: "underline",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
