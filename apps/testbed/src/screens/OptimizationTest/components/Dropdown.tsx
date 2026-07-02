import React from "react";
import { Box } from "@eight2five/ui/box";
import { FormControl } from "@eight2five/ui/form-control";
import { HStack } from "@eight2five/ui/hstack";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@eight2five/ui/select";
import { ChevronDownIcon } from "@eight2five/ui/icon";
import { LabelWithTooltip } from "./LabelWithTooltip";

export const Dropdown = ({
  label,
  value,
  options,
  onSelect,
  disabled = false,
  onToggle,
  tooltip,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (v: string) => void;
  disabled?: boolean;
  onToggle?: (isOpen: boolean) => void;
  tooltip?: string;
}) => {
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <FormControl isDisabled={disabled} className={disabled ? "opacity-50" : ""}>
      <HStack className="mb-3 items-center justify-between">
        <Box className="mr-3 flex-1">
          {label ? <LabelWithTooltip label={label} tooltip={tooltip} /> : null}
        </Box>
        <Box className="w-36">
          <Select
            selectedValue={value}
            initialLabel={selectedLabel ?? value}
            onValueChange={onSelect}
            onOpen={() => onToggle?.(true)}
            onClose={() => onToggle?.(false)}
            isDisabled={disabled}
          >
            <SelectTrigger testID="dropdown-button" size="sm">
              <SelectInput
                value={selectedLabel ?? value}
                placeholder="Select"
                className="flex-1"
              />
              <SelectIcon as={ChevronDownIcon} className="mr-2" />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent className="max-h-80">
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                {options.map((option) => (
                  <SelectItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </SelectContent>
            </SelectPortal>
          </Select>
        </Box>
      </HStack>
    </FormControl>
  );
};
