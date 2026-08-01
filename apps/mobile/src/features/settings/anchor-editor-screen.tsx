import React from "react";
import { Radio, Save, TriangleAlert } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Card } from "@eight2five/ui/components/card";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { MarchingCoordinateForm } from "../drill/components/marching-coordinate-form";
import { formatAnchorCanonicalPreview } from "./anchor-editor-form";
import { confirmAnchorPositionWrite } from "./anchor-write-confirmation";
import {
  AnchorNumberInput,
  StandardAnchorPositionForm,
} from "./standard-anchor-position-form";
import { useAnchorEditorController } from "./use-anchor-editor-controller";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
  SettingsValueRow,
} from "./settings-components";

export function AnchorEditorScreen({
  anchorId,
}: {
  readonly anchorId: string;
}) {
  const theme = useEight2FiveTheme();
  const controller = useAnchorEditorController(anchorId);
  const preview = formatAnchorCanonicalPreview(controller.validation.position);

  if (!controller.developerModeEnabled) {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="info">
          Enable Developer Mode before editing anchor positions.
        </SettingsMessage>
      </SettingsScreenContainer>
    );
  }

  return (
    <SettingsScreenContainer>
      {controller.error ? (
        <SettingsMessage tone="error">
          {controller.error.message}
        </SettingsMessage>
      ) : null}
      {controller.saved ? (
        <SettingsMessage tone="info">
          Anchor position written. PANS positions are write-only, so the cache
          records this successful unverified write.
        </SettingsMessage>
      ) : null}
      <SettingsSection title="Anchor">
        <SettingsValueRow
          icon={Radio}
          title={
            controller.anchor?.nodeIdHex ??
            controller.anchor?.label ??
            "Cached anchor"
          }
          description={controller.anchor?.transportDeviceId}
          value={controller.loading ? "Loading" : controller.connectionState}
        />
      </SettingsSection>

      <HStack style={{ gap: eight2FiveSpacing.sm }}>
        <Button
          className="flex-1"
          variant={controller.mode === "marching" ? "default" : "outline"}
          onPress={() => controller.setMode("marching")}
          testID="anchor-mode-marching"
        >
          <ButtonText>Marching</ButtonText>
        </Button>
        <Button
          className="flex-1"
          variant={controller.mode === "standard" ? "default" : "outline"}
          onPress={() => controller.setMode("standard")}
          testID="anchor-mode-standard"
        >
          <ButtonText>Standard Units</ButtonText>
        </Button>
      </HStack>

      {controller.mode === "marching" ? (
        <VStack style={{ gap: eight2FiveSpacing.lg }}>
          <MarchingCoordinateForm
            draft={controller.marchingDraft.coordinate}
            terminologySingular="Anchor"
            showDetails={false}
            disabled={controller.saving}
            onChange={(coordinate) =>
              controller.setMarchingDraft({
                ...controller.marchingDraft,
                coordinate,
              })
            }
          />
          <SettingsSection title="Height">
            <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
              <HStack style={{ gap: 8 }}>
                {(["meters", "feet"] as const).map((unit) => (
                  <Button
                    key={unit}
                    className="flex-1"
                    size="sm"
                    variant={
                      controller.marchingDraft.heightUnit === unit
                        ? "default"
                        : "outline"
                    }
                    onPress={() => controller.updateMarchingHeightUnit(unit)}
                  >
                    <ButtonText>
                      {unit === "meters" ? "Meters" : "Feet"}
                    </ButtonText>
                  </Button>
                ))}
              </HStack>
              <AnchorNumberInput
                label="Anchor height"
                value={controller.marchingDraft.height}
                error={controller.validation.errors.height}
                helper="Height is measured upward from the field surface."
                disabled={controller.saving}
                onChange={(height) =>
                  controller.setMarchingDraft({
                    ...controller.marchingDraft,
                    height,
                  })
                }
              />
            </VStack>
          </SettingsSection>
        </VStack>
      ) : (
        <SettingsSection title="Reference Position">
          <VStack style={{ padding: eight2FiveSpacing.md }}>
            <StandardAnchorPositionForm
              draft={controller.standardDraft}
              errors={controller.validation.errors}
              disabled={controller.saving}
              onChange={controller.setStandardDraft}
              onReferenceChange={controller.updateStandardReference}
              onUnitChange={controller.updateStandardUnit}
            />
          </VStack>
        </SettingsSection>
      )}

      <Card
        style={{
          gap: 6,
          borderRadius: eight2FiveRadii.md,
          borderColor: preview ? theme.border : theme.danger,
          backgroundColor: theme.accentSoft,
        }}
      >
        <Text style={{ color: theme.text }}>Canonical preview</Text>
        <Text selectable style={{ color: theme.text }}>
          {preview?.marching ?? "Complete a valid in-bounds position."}
        </Text>
        {preview ? (
          <Text selectable style={{ color: theme.text }}>
            {preview.meters}
          </Text>
        ) : null}
      </Card>

      {controller.connectionState !== "connected" ? (
        <HStack style={{ gap: 10 }}>
          <Icon as={TriangleAlert} style={{ color: theme.warning }} />
          <Text style={{ color: theme.textMuted }}>
            A live tag connection is required before the confirmed hardware
            write.
          </Text>
        </HStack>
      ) : null}
      <Button
        testID="save-anchor-position-button"
        isDisabled={
          !controller.validation.position ||
          controller.connectionState !== "connected" ||
          controller.saving
        }
        onPress={() => {
          const position = controller.validation.position;
          if (position) {
            confirmAnchorPositionWrite(
              position,
              () => void controller.save(position),
            );
          }
        }}
      >
        {controller.saving ? <ButtonSpinner /> : <ButtonIcon as={Save} />}
        <ButtonText>Save Anchor Position</ButtonText>
      </Button>
    </SettingsScreenContainer>
  );
}
