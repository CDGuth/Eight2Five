import React from "react";
import { Badge, BadgeText } from "@eight2five/ui/badge";
import { Card } from "@eight2five/ui/card";
import { HStack } from "@eight2five/ui/hstack";
import { ArrowRightIcon, Icon } from "@eight2five/ui/icon";
import { Pressable } from "@eight2five/ui/pressable";
import { Text } from "@eight2five/ui/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/vstack";

interface SubappCardProps {
  title: string;
  description: string;
  cta?: string;
  badge?: string;
  onPress: () => void;
}

export function SubappCard({
  title,
  description,
  cta = "Open",
  badge,
  onPress,
}: SubappCardProps) {
  const theme = useEight2FiveTheme();

  return (
    <Pressable
      onPress={onPress}
      testID={`subapp-card-${title}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      style={{ marginBottom: eight2FiveSpacing.md }}
    >
      <Card
        className="p-0"
        style={{
          borderWidth: 0,
          borderRadius: eight2FiveRadii.md,
          backgroundColor: theme.surfaceRaised,
          padding: eight2FiveSpacing.lg,
          boxShadow: `0 10px 28px ${theme.shadowStrong}`,
        }}
      >
        <VStack style={{ gap: eight2FiveSpacing.md }}>
          <HStack className="items-center justify-between" style={{ gap: 12 }}>
            <Text
              size="lg"
              className="flex-1"
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
          <HStack className="items-center" style={{ gap: 6 }}>
            <Text
              size="sm"
              style={{
                color: theme.accent,
                fontFamily: eight2FiveFonts.styleSemibold,
              }}
            >
              {cta}
            </Text>
            <Icon
              as={ArrowRightIcon}
              size="sm"
              style={{ color: theme.accent }}
            />
          </HStack>
        </VStack>
      </Card>
    </Pressable>
  );
}
