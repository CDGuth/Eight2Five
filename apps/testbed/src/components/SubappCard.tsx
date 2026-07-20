import React from "react";
import { ChevronRight } from "lucide-react-native";
import { Badge, BadgeText } from "@eight2five/ui/components/badge";
import { Divider } from "@eight2five/ui/components/divider";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

interface SubappCardProps {
  title: string;
  description: string;
  badge?: string;
  onPress: () => void;
}

export function SubappCard({
  title,
  description,
  badge,
  onPress,
}: SubappCardProps) {
  const theme = useEight2FiveTheme();

  return (
    <VStack className="w-full">
      <Pressable
        className="w-full"
        onPress={onPress}
        testID={`subapp-card-${title}`}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        style={{
          backgroundColor: theme.background,
          paddingVertical: eight2FiveSpacing.md,
        }}
      >
        <HStack className="items-center" style={{ gap: eight2FiveSpacing.md }}>
          <VStack className="flex-1" style={{ gap: eight2FiveSpacing.xs }}>
            <HStack
              className="flex-wrap items-center"
              style={{ gap: eight2FiveSpacing.sm }}
            >
              <Text
                size="lg"
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.styleBold,
                }}
              >
                {title}
              </Text>
              {badge ? (
                <Badge variant="secondary">
                  <BadgeText>{badge}</BadgeText>
                </Badge>
              ) : null}
            </HStack>
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              {description}
            </Text>
          </VStack>
          <Icon as={ChevronRight} size="lg" style={{ color: theme.icon }} />
        </HStack>
      </Pressable>
      <Divider
        testID={`subapp-divider-${title}`}
        style={{ backgroundColor: theme.border }}
      />
    </VStack>
  );
}
