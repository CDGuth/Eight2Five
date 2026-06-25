import React from "react";
import { ViewStyle, ScrollViewProps, LayoutAnimation } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Box } from "@eight2five/ui/box";
import { Heading } from "@eight2five/ui/heading";
import { HStack } from "@eight2five/ui/hstack";
import { Pressable } from "@eight2five/ui/pressable";
import { ScrollView } from "@eight2five/ui/scroll-view";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

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
    <SafeAreaView style={{ flex: 1 }}>
      <VStack className="flex-1 bg-background px-5 py-4">
        {(title || subtitle || showNav) && (
          <HStack className="mb-4 mt-1 items-center">
            <Box
              style={{ width: showNav ? 72 : 0, overflow: "hidden" }}
              className="items-center justify-center"
            >
              {showNav && (
                <Box
                  style={{ borderRadius: isMultiNav ? 24 : 25 }}
                  className="border border-border bg-card p-0.5 shadow-sm"
                >
                  {onBack && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Go to testbed home"
                      onPress={onBack}
                      className="h-11 w-11 items-center justify-center"
                      testID="testbed-home-button"
                    >
                      <MaterialIcons
                        name="home"
                        size={28}
                        color="rgb(23 23 23)"
                      />
                    </Pressable>
                  )}
                  {onSubBack && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                      onPress={onSubBack}
                      className="h-11 w-11 items-center justify-center border-t border-border"
                      testID="testbed-sub-back-button"
                    >
                      <MaterialIcons
                        name="arrow-back"
                        size={28}
                        color="rgb(23 23 23)"
                      />
                    </Pressable>
                  )}
                </Box>
              )}
            </Box>

            <VStack className="shrink">
              {title ? (
                <Heading size="xl" className="text-foreground">
                  {title}
                </Heading>
              ) : null}
              {subtitle ? (
                <Text size="sm" className="mt-0.5 text-muted-foreground">
                  {subtitle}
                </Text>
              ) : null}
            </VStack>
          </HStack>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </VStack>
    </SafeAreaView>
  );
}
