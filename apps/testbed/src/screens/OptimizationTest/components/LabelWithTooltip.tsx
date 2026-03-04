import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "../styles";
import { testbedPalette } from "../../../styles/testbed";

export const LabelWithTooltip = ({
  label,
  tooltip,
}: {
  label: string;
  tooltip?: string;
}) => (
  <View style={styles.labelContainer}>
    <Text style={styles.labelText}>{label}</Text>
    {tooltip && (
      <TouchableOpacity
        onPress={() => Alert.alert(label, tooltip)}
        style={{ marginLeft: 6 }}
      >
        <MaterialIcons
          name="help-outline"
          size={16}
          color={testbedPalette.muted}
        />
      </TouchableOpacity>
    )}
  </View>
);
