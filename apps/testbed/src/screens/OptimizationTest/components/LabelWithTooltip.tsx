import React from "react";
import { HStack } from "@eight2five/ui/hstack";
import { HelpCircleIcon, Icon } from "@eight2five/ui/icon";
import { Pressable } from "@eight2five/ui/pressable";
import { Text } from "@eight2five/ui/text";

import { useTestbedToast } from "../../../hooks/useTestbedToast";

export const LabelWithTooltip = ({
  label,
  tooltip,
}: {
  label: string;
  tooltip?: string;
}) => {
  const showToast = useTestbedToast();

  return (
    <HStack space="xs" className="items-center">
      <Text size="sm" className="text-foreground">
        {label}
      </Text>
      {tooltip && (
        <Pressable
          onPress={() =>
            showToast({ title: label, description: tooltip, action: "info" })
          }
          accessibilityRole="button"
          accessibilityLabel={`Show help for ${label}`}
        >
          <Icon
            as={HelpCircleIcon}
            size="sm"
            className="text-muted-foreground"
          />
        </Pressable>
      )}
    </HStack>
  );
};
