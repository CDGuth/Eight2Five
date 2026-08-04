import React from "react";
import { useWindowDimensions } from "react-native";
import type { DrillDocument, DrillEntity } from "@eight2five/drill-schema";
import {
  Button,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Heading } from "@eight2five/ui/components/heading";
import { HStack } from "@eight2five/ui/components/hstack";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@eight2five/ui/components/modal";
import { Pressable } from "@eight2five/ui/components/pressable";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { SettingsMessage } from "../../settings/settings-components";
import { getPerformerSymbolGroups } from "../drill-import";

interface PerformerSelectionDialogProps {
  readonly document?: DrillDocument;
  readonly isOpen: boolean;
  readonly importing: boolean;
  readonly error?: Error;
  readonly onClose: () => void;
  readonly onConfirm: (performerEntityId: number) => Promise<void>;
}

export function PerformerSelectionDialog(props: PerformerSelectionDialogProps) {
  if (!props.document) return null;
  return (
    <PerformerSelectionDialogContent {...props} document={props.document} />
  );
}

function PerformerSelectionDialogContent({
  document,
  isOpen,
  importing,
  error,
  onClose,
  onConfirm,
}: PerformerSelectionDialogProps & { readonly document: DrillDocument }) {
  const theme = useEight2FiveTheme();
  const { height } = useWindowDimensions();
  const groups = React.useMemo(
    () => getPerformerSymbolGroups(document),
    [document],
  );
  const [selectedSymbol, setSelectedSymbol] = React.useState(groups[0]?.symbol);
  const [selectedPerformer, setSelectedPerformer] =
    React.useState<DrillEntity>();
  const visiblePerformers =
    groups.find((group) => group.symbol === selectedSymbol)?.performers ?? [];
  const listHeight = Math.min(380, Math.max(230, height * 0.45));

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!importing) onClose();
      }}
      size="lg"
    >
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">Select your dot</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack style={{ gap: eight2FiveSpacing.md }}>
            <Text style={{ color: theme.textMuted }}>
              Choose your performer symbol on the left, then select your label
              on the right. Props may be present in the uploaded file, but they
              are not selectable as your dot.
            </Text>

            {error ? (
              <SettingsMessage tone="error">{error.message}</SettingsMessage>
            ) : null}

            <HStack
              style={{
                height: listHeight,
                gap: eight2FiveSpacing.sm,
              }}
            >
              <VStack
                style={{
                  width: 112,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: eight2FiveRadii.md,
                  overflow: "hidden",
                }}
              >
                <ScrollView
                  nestedScrollEnabled
                  contentContainerStyle={{ padding: eight2FiveSpacing.xs }}
                >
                  <VStack style={{ gap: eight2FiveSpacing.xs }}>
                    {groups.map((group) => {
                      const selected = group.symbol === selectedSymbol;
                      return (
                        <Pressable
                          key={group.symbol}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Performer symbol ${group.symbol}`}
                          onPress={() => {
                            if (importing) return;
                            setSelectedSymbol(group.symbol);
                            setSelectedPerformer(undefined);
                          }}
                          style={{
                            minHeight: 44,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: eight2FiveSpacing.sm,
                            borderRadius: eight2FiveRadii.sm,
                            backgroundColor: selected
                              ? theme.accent
                              : theme.surfaceRaised,
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? theme.raw.white : theme.text,
                              fontSize: 18,
                            }}
                          >
                            {group.symbol}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </VStack>
                </ScrollView>
              </VStack>

              <VStack
                className="flex-1"
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: eight2FiveRadii.md,
                  overflow: "hidden",
                }}
              >
                <ScrollView
                  nestedScrollEnabled
                  contentContainerStyle={{ padding: eight2FiveSpacing.xs }}
                >
                  <VStack style={{ gap: eight2FiveSpacing.xs }}>
                    {visiblePerformers.map((performer) => {
                      const selected = performer.id === selectedPerformer?.id;
                      return (
                        <Pressable
                          key={performer.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Performer ${performer.label}`}
                          onPress={() => {
                            if (!importing) setSelectedPerformer(performer);
                          }}
                          style={{
                            minHeight: 48,
                            justifyContent: "center",
                            paddingHorizontal: eight2FiveSpacing.md,
                            paddingVertical: eight2FiveSpacing.sm,
                            borderRadius: eight2FiveRadii.sm,
                            backgroundColor: selected
                              ? theme.accent
                              : theme.surfaceRaised,
                          }}
                        >
                          <Text
                            style={{
                              color: selected ? theme.raw.white : theme.text,
                            }}
                          >
                            {performer.label}
                          </Text>
                          {performer.name ? (
                            <Text
                              size="sm"
                              style={{
                                color: selected
                                  ? theme.raw.white
                                  : theme.textMuted,
                              }}
                            >
                              {performer.name}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </VStack>
                </ScrollView>
              </VStack>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onPress={onClose} isDisabled={importing}>
            <ButtonText>Cancel</ButtonText>
          </Button>
          <Button
            onPress={() => {
              if (selectedPerformer) void onConfirm(selectedPerformer.id);
            }}
            isDisabled={!selectedPerformer || importing}
          >
            {importing ? <ButtonSpinner /> : null}
            <ButtonText>{importing ? "Importing…" : "Use This Dot"}</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
