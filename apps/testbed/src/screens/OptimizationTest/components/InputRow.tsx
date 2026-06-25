import React from "react";
import { Box } from "@eight2five/ui/box";
import { FormControl } from "@eight2five/ui/form-control";
import { HStack } from "@eight2five/ui/hstack";
import { Input, InputField } from "@eight2five/ui/input";
import { LabelWithTooltip } from "./LabelWithTooltip";

export const InputRow = ({
  label,
  value,
  onChange,
  tooltip,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tooltip?: string;
  disabled?: boolean;
}) => (
  <FormControl isDisabled={disabled} className={disabled ? "opacity-50" : ""}>
    <HStack className="mb-3 items-center justify-between">
      <Box className="mr-3 flex-1">
        <LabelWithTooltip label={label} tooltip={tooltip} />
      </Box>
      <Box className="w-36">
        <Input>
          <InputField
            value={value}
            onChangeText={onChange}
            keyboardType="numeric"
            editable={!disabled}
          />
        </Input>
      </Box>
    </HStack>
  </FormControl>
);
