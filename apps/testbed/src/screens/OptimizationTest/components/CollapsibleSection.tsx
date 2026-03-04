import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "../styles";

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
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <MaterialIcons
          name={isOpen ? "remove" : "add"}
          size={20}
          style={styles.collapseIcon}
        />
      </TouchableOpacity>
      {isOpen && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
};
