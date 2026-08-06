import React from "react";
import { Alert } from "react-native";
import { Trash2, X } from "lucide-react-native";
import type {
  Drill,
  DrillDocument,
  DrillTerms,
} from "@eight2five/mobile/drill";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@eight2five/ui/components/modal";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { SpinningLoaderIcon } from "../../../components/spinning-loader-icon";
import { SettingsMessage } from "../../settings/settings-components";
import { resolveDrillIcon } from "../drill-icons";

export function DrillPropertiesDialog({
  drill,
  document,
  terms,
  isOpen,
  loading,
  saving,
  error,
  onClose,
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
  readonly onDelete: () => Promise<void>;
}) {
  const theme = useEight2FiveTheme();
  if (!drill) return null;
  const metadata = document?.metadata ?? drill.metadata;
  const DrillIcon = resolveDrillIcon(drill.metadata?.lucideIcon);

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
    <Modal isOpen={isOpen} onClose={saving ? undefined : onClose} size="lg">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader className="items-center justify-between">
          <Heading size="md">Drill Info</Heading>
          <ModalCloseButton
            accessibilityLabel="Close drill info"
            disabled={saving}
          >
            <Icon as={X} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          <VStack style={{ gap: eight2FiveSpacing.md }}>
            {loading ? (
              <Text style={{ color: theme.textMuted }}>Loading metadata…</Text>
            ) : null}
            {error ? (
              <SettingsMessage tone="error">{error.message}</SettingsMessage>
            ) : null}

            <VStack
              className="items-center"
              style={{ gap: eight2FiveSpacing.xs }}
            >
              <Icon as={DrillIcon} size={48} style={{ color: theme.text }} />
              <Text
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.styleSemibold,
                  fontSize: 18,
                }}
              >
                {drill.name}
              </Text>
            </VStack>

            <VStack
              style={{
                gap: eight2FiveSpacing.sm,
                padding: eight2FiveSpacing.md,
                borderRadius: eight2FiveRadii.lg,
                borderCurve: "continuous",
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
            {saving ? <SpinningLoaderIcon /> : <ButtonIcon as={Trash2} />}
            <ButtonText>Delete</ButtonText>
          </Button>
          <Button variant="ghost" onPress={onClose} isDisabled={saving}>
            <ButtonText>Close</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
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
