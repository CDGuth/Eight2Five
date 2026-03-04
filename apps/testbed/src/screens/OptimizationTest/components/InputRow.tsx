import React from "react";
import { View, TextInput } from "react-native";
import { styles } from "../styles";
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
  <View style={[styles.inputRow, disabled && { opacity: 0.5 }]}>
    <LabelWithTooltip label={label} tooltip={tooltip} />
    <View style={styles.controlWrapper}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor="#999"
        editable={!disabled}
      />
    </View>
  </View>
);
