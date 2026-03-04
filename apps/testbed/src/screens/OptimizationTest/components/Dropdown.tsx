import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { styles } from "../styles";
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
  const [isOpen, setIsOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const buttonRef = useRef<any>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onToggle?.(false);
  }, [onToggle]);

  const updateMenuLayout = useCallback(() => {
    requestAnimationFrame(() => {
      buttonRef.current?.measureInWindow?.(
        (x: number, y: number, width: number, height: number) => {
          setMenuLayout({ x, y: y + height, width, height });
        },
      );
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    onToggle?.(true);
    requestAnimationFrame(() => {
      if (!buttonRef.current?.measureInWindow) {
        setIsOpen(true);
        return;
      }
      buttonRef.current.measureInWindow(
        (x: number, y: number, width: number, height: number) => {
          setMenuLayout({ x, y: y + height, width, height });
          setIsOpen(true);
        },
      );
    });
  }, [disabled, onToggle]);

  const handleToggle = () => {
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  };

  const handleSelect = (val: string) => {
    onSelect(val);
    closeMenu();
  };

  return (
    <View
      style={[
        styles.inputRow,
        { zIndex: isOpen ? 1000 : 1 },
        disabled && { opacity: 0.5 },
      ]}
    >
      {label ? (
        <LabelWithTooltip label={label} tooltip={tooltip} />
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={styles.controlWrapper}>
        <TouchableOpacity
          ref={buttonRef}
          style={styles.dropdownButton}
          testID="dropdown-button"
          onPress={() => !disabled && handleToggle()}
          onLayout={updateMenuLayout}
          disabled={disabled}
        >
          <Text style={styles.dropdownButtonText} numberOfLines={1}>
            {options.find((o) => o.value === value)?.label || value}
          </Text>
        </TouchableOpacity>
        {isOpen && (
          <Modal
            transparent
            animationType="fade"
            visible={isOpen}
            onRequestClose={closeMenu}
          >
            <View
              style={styles.dropdownModalContainer}
              pointerEvents="box-none"
            >
              <Pressable style={styles.dropdownBackdrop} onPress={closeMenu} />
              <View
                style={[
                  styles.dropdownList,
                  styles.dropdownModalList,
                  {
                    top: menuLayout.y,
                    left: menuLayout.x,
                    width: menuLayout.width || 140,
                  },
                ]}
              >
                <ScrollView
                  style={{ maxHeight: 220 }}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="always"
                  persistentScrollbar={true}
                >
                  {options.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.dropdownItem}
                      onPress={() => handleSelect(opt.value)}
                    >
                      <Text style={styles.dropdownItemText}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </View>
  );
};
