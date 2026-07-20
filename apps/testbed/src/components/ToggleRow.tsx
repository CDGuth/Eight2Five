import React from "react";
import { HStack } from "@eight2five/ui/components/hstack";
import { Switch } from "@eight2five/ui/components/switch";
import { Text } from "@eight2five/ui/components/text";

interface ToggleRowProps {
  label: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({
  label,
  isChecked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <HStack className="mb-3 items-center justify-between py-1">
      <Text size="sm" className="mr-3 flex-1 text-foreground">
        {label}
      </Text>
      <Switch
        value={isChecked}
        onValueChange={onChange}
        isDisabled={disabled}
      />
    </HStack>
  );
}
