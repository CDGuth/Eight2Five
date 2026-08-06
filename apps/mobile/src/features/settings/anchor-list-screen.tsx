import { useRouter } from "expo-router";
import { Database, Pencil, RefreshCw, Triangle } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import { SpinningLoaderIcon } from "../../components/spinning-loader-icon";
import { useAnchorListController } from "./use-anchor-list-controller";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
  SettingsValueRow,
} from "./settings-components";

export function AnchorListScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const controller = useAnchorListController();

  if (!controller.developerModeEnabled) {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="info">
          Enable Developer Mode before viewing or editing cached anchors.
        </SettingsMessage>
      </SettingsScreenContainer>
    );
  }

  return (
    <SettingsScreenContainer>
      {controller.error ? (
        <SettingsMessage tone="error">
          {controller.error.message}
        </SettingsMessage>
      ) : null}
      <SettingsSection title="Anchor Cache">
        <SettingsValueRow
          icon={Database}
          title="Locally known anchors"
          description="Coordinates are read from local cache, not continuously from hardware."
          value={controller.anchors.length.toString()}
        />
        <VStack style={{ padding: eight2FiveSpacing.md }}>
          <Button
            variant="outline"
            testID="refresh-cached-anchors-button"
            isDisabled={controller.refreshing}
            onPress={() => void controller.refresh()}
          >
            {controller.refreshing ? (
              <SpinningLoaderIcon />
            ) : (
              <ButtonIcon as={RefreshCw} />
            )}
            <ButtonText>Refresh Local Cache</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>

      <SettingsSection title="Anchors">
        {controller.anchors.length === 0 ? (
          <HStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
            <Icon as={Triangle} style={{ color: theme.textMuted }} />
            <Text style={{ color: theme.textMuted }}>
              No anchors are cached. Discover the deployment with the tag to
              cache nearby anchors.
            </Text>
          </HStack>
        ) : (
          controller.anchors.map((anchor) => {
            const config =
              anchor.lastKnownConfig?.role === "anchor"
                ? anchor.lastKnownConfig
                : undefined;
            const position = config?.position;
            return (
              <Pressable
                key={anchor.id}
                testID={`edit-anchor-${anchor.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Edit anchor ${anchor.nodeIdHex ?? anchor.label ?? anchor.id}`}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/settings/anchor/[anchorId]",
                    params: { anchorId: anchor.id },
                  })
                }
              >
                <HStack
                  className="items-center"
                  style={{ gap: 12, padding: eight2FiveSpacing.md }}
                >
                  <Icon as={Triangle} style={{ color: theme.warning }} />
                  <VStack className="flex-1" style={{ gap: 2 }}>
                    <Text selectable style={{ color: theme.text }}>
                      {anchor.nodeIdHex ?? anchor.label ?? anchor.id}
                    </Text>
                    <Text size="sm" style={{ color: theme.textMuted }}>
                      Initiator:{" "}
                      {config
                        ? config.initiatorEnabled
                          ? "Yes"
                          : "No"
                        : "Unknown"}
                    </Text>
                    <Text
                      selectable
                      size="sm"
                      style={{ color: theme.textMuted }}
                    >
                      {position
                        ? `${position.xMeters.toFixed(3)}, ${position.yMeters.toFixed(3)}, ${position.zMeters.toFixed(3)} m`
                        : "Coordinate not cached"}
                    </Text>
                    <Text size="sm" style={{ color: theme.textMuted }}>
                      {position
                        ? "Source: local PANS cache"
                        : "Status: not configured"}
                    </Text>
                  </VStack>
                  <Icon as={Pencil} style={{ color: theme.accent }} />
                </HStack>
              </Pressable>
            );
          })
        )}
      </SettingsSection>
    </SettingsScreenContainer>
  );
}
