import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
  ScrollViewProps,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { testbedStyles, testbedPalette } from "../styles/testbed";

interface TestbedLayoutProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onSubBack?: () => void;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
}

export function TestbedLayout({
  title,
  subtitle,
  onBack,
  onSubBack,
  children,
  contentStyle,
  scrollProps,
}: TestbedLayoutProps) {
  const showNav = Boolean(onBack) || Boolean(onSubBack);
  const isMultiNav = Boolean(onBack) && Boolean(onSubBack);

  // Trigger animation when nav state changes
  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [onBack, onSubBack]);

  return (
    <SafeAreaView style={testbedStyles.safeArea}>
      <View style={testbedStyles.container}>
        {(title || subtitle || showNav) && (
          <View style={testbedStyles.header}>
            <View
              style={[
                testbedStyles.navColumn,
                { width: showNav ? 72 : 0, overflow: "hidden" },
              ]}
            >
              {showNav && (
                <View
                  style={[
                    testbedStyles.floatingNav,
                    {
                      borderRadius: isMultiNav ? 24 : 25,
                    },
                  ]}
                >
                  {onBack && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Go to testbed home"
                      onPress={onBack}
                      style={testbedStyles.homeButton}
                      testID="testbed-home-button"
                    >
                      <MaterialIcons
                        name="home"
                        size={28}
                        style={testbedStyles.homeButtonIcon}
                      />
                    </TouchableOpacity>
                  )}
                  {onSubBack && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                      onPress={onSubBack}
                      style={testbedStyles.subBackButton}
                      testID="testbed-sub-back-button"
                    >
                      <MaterialIcons
                        name="arrow-back"
                        size={28}
                        color={testbedPalette.accent}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={testbedStyles.titleBlock}>
              {title ? <Text style={testbedStyles.title}>{title}</Text> : null}
              {subtitle ? (
                <Text style={testbedStyles.subtitle}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
        )}

        <ScrollView
          style={testbedStyles.body}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
