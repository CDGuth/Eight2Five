import React from "react";
import { Badge, BadgeText } from "@eight2five/ui/badge";
import { Card } from "@eight2five/ui/card";
import { HStack } from "@eight2five/ui/hstack";
import { Pressable } from "@eight2five/ui/pressable";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";
import { ArrowRightIcon, Icon } from "@eight2five/ui/icon";

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
  return (
    <Pressable
      onPress={onPress}
      testID={`subapp-card-${title}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      className="mb-4"
    >
      <Card className="border border-border bg-card p-5 shadow-sm">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <Text size="lg" bold className="mr-2 flex-1 text-card-foreground">
              {title}
            </Text>
            {badge ? (
              <Badge variant="secondary">
                <BadgeText>{badge}</BadgeText>
              </Badge>
            ) : null}
          </HStack>
          <Text size="sm" className="text-muted-foreground">
            {description}
          </Text>
          <HStack space="xs" className="items-center">
            <Text size="sm" bold className="text-primary">
              {cta}
            </Text>
            <Icon as={ArrowRightIcon} size="sm" className="text-primary" />
          </HStack>
        </VStack>
      </Card>
    </Pressable>
  );
}
