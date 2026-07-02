import React, { useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Box } from "@eight2five/ui/box";
import { Card } from "@eight2five/ui/card";
import { Heading } from "@eight2five/ui/heading";
import { HStack } from "@eight2five/ui/hstack";
import { Pressable } from "@eight2five/ui/pressable";

export const CollapsibleSection = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="mb-5 overflow-hidden border border-border bg-card p-0">
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={title}
        className="bg-muted px-4 py-3"
      >
        <HStack className="items-center justify-between">
          <Heading size="sm" className="text-primary">
            {title}
          </Heading>
          <MaterialIcons name={isOpen ? "remove" : "add"} size={20} />
        </HStack>
      </Pressable>
      {isOpen && <Box className="p-4">{children}</Box>}
    </Card>
  );
};
