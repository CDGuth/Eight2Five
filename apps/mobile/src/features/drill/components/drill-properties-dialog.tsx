import React from "react";
import { Alert } from "react-native";
import { Check, Trash2 } from "lucide-react-native";
import type {
  Drill,
  DrillDocument,
  DrillTerms,
  UpdateDrillPropertiesInput,
} from "@eight2five/mobile/drill";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@eight2five/ui/components/form-control";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
import { Input, InputField } from "@eight2five/ui/components/input";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@eight2five/ui/components/modal";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { SettingsMessage } from "../../settings/settings-components";
import { DRILL_ICON_NAMES, resolveDrillIcon } from "../drill-icons";
import { DRILL_NAME_MAX_LENGTH, validateDrillName } from "../drill-management";

export function DrillPropertiesDialog({
  drill,
  document,
  terms,
  isOpen,
  loading,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  readonly drill?: Drill;
  readonly document?: DrillDocument;
  readonly terms: DrillTerms;
  readonly isOpen: boolean;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error?: Error;
  readonly onClose: () => void;
  readonly onSave: (input: UpdateDrillPropertiesInput) => Promise<void>;
  readonly onDelete: () => Promise<void>;
}) {
  const theme = useEight2FiveTheme();
  const [name, setName] = React.useState(drill?.name ?? "");
  const [iconName, setIconName] = React.useState<string | undefined>(
    drill?.metadata?.lucideIcon,
  );
  const [formError, setFormError] = React.useState<string>();

  if (!drill) return null;
  const metadata = document?.metadata ?? drill.metadata;

  const save = async () => {
    const validationError = validateDrillName(name);
    setFormError(validationError);
    if (validationError) return;
    try {
      await onSave({
        name: name.trim(),
        lucideIcon: iconName ?? null,
      });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete “${drill.name}”?`,
      `This permanently deletes the drill and all of its ${terms.lowercasePlural}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void onDelete().catch(() => undefined),
        },
      ],
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!saving && !loading) onClose();
      }}
      size="lg"
      avoidKeyboard
    >
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">Drill Info</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack style={{ gap: eight2FiveSpacing.md }}>
            {loading ? (
              <Text style={{ color: theme.textMuted }}>Loading metadata…</Text>
            ) : null}
            {error ? (
              <SettingsMessage tone="error">{error.message}</SettingsMessage>
            ) : null}
            {formError ? (
              <SettingsMessage tone="error">{formError}</SettingsMessage>
            ) : null}

            <FormControl isRequired isInvalid={Boolean(formError)}>
              <FormControlLabel>
                <FormControlLabelText>Drill name</FormControlLabelText>
              </FormControlLabel>
              <Input isDisabled={saving}>
                <InputField
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    if (formError) setFormError(undefined);
                  }}
                  maxLength={DRILL_NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  accessibilityLabel="Drill name"
                />
              </Input>
            </FormControl>

            <VStack style={{ gap: eight2FiveSpacing.xs }}>
              <Text
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.styleSemibold,
                }}
              >
                Card icon
              </Text>
              <HStackWrap>
                <IconChoice
                  label="Default drill icon"
                  selected={!iconName}
                  icon={resolveDrillIcon(undefined)}
                  onPress={() => setIconName(undefined)}
                />
                {DRILL_ICON_NAMES.map((nameOption) => (
                  <IconChoice
                    key={nameOption}
                    label={`Use ${nameOption} icon`}
                    selected={iconName === nameOption}
                    icon={resolveDrillIcon(nameOption)}
                    onPress={() => setIconName(nameOption)}
                  />
                ))}
              </HStackWrap>
            </VStack>

            <VStack
              style={{
                gap: eight2FiveSpacing.sm,
                padding: eight2FiveSpacing.md,
                borderRadius: eight2FiveRadii.md,
                backgroundColor: theme.surface,
              }}
            >
              <MetadataRow label="Writer" value={metadata?.drillWriter} />
              <MetadataRow label="Ensemble" value={metadata?.ensemble} />
              <MetadataRow label="Description" value={metadata?.description} />
              <MetadataRow
                label="Created"
                value={formatMetadataDate(metadata?.createdAt)}
              />
              <MetadataRow
                label="Source"
                value={formatSourceMetadata(document)}
              />
            </VStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="destructive"
            onPress={confirmDelete}
            isDisabled={saving || loading}
            accessibilityLabel={`Delete ${drill.name}`}
          >
            <ButtonIcon as={Trash2} />
            <ButtonText>Delete</ButtonText>
          </Button>
          <Button variant="ghost" onPress={onClose} isDisabled={saving}>
            <ButtonText>Cancel</ButtonText>
          </Button>
          <Button
            onPress={() => void save()}
            isDisabled={saving || loading}
            accessibilityState={{ busy: saving, disabled: saving || loading }}
          >
            {saving ? <ButtonSpinner /> : <ButtonIcon as={Check} />}
            <ButtonText>Save</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function HStackWrap({ children }: { readonly children: React.ReactNode }) {
  return (
    <VStack
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: eight2FiveSpacing.xs,
      }}
    >
      {children}
    </VStack>
  );
}

function IconChoice({
  label,
  selected,
  icon,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly icon: React.ElementType;
  readonly onPress: () => void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        width: 44,
        height: 44,
        borderRadius: eight2FiveRadii.sm,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.accent : theme.border,
        backgroundColor: selected ? theme.accentSoft : theme.surfaceRaised,
      }}
    >
      <Icon as={icon} size="md" style={{ color: theme.text }} />
    </Pressable>
  );
}

function MetadataRow({ label, value }: { label: string; value?: string }) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: 2 }}>
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text style={{ color: theme.text }}>{value || "—"}</Text>
    </VStack>
  );
}

function formatMetadataDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

function formatSourceMetadata(
  document: DrillDocument | undefined,
): string | undefined {
  if (!document?.provenance) return undefined;
  const source = document.provenance.source;
  const importer = document.provenance.importer;
  const values = [
    source?.fileName ?? source?.kind,
    importer ? `${importer.name} ${importer.version}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(" · ") : undefined;
}
