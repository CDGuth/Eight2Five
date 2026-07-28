import React from "react";
import {
  Button,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";
import { SettingInfoCard } from "../setting-help";
import { FormSection } from "./device-settings-fields";

export interface DestructiveActionSectionProps {
  available: boolean;
  confirmationVisible: boolean;
  busy: boolean;
  onRequest(): void;
  onConfirm(): void;
  onCancel(): void;
}
export const DestructiveActionSection = React.memo(
  function DestructiveActionSection({
    available,
    confirmationVisible,
    busy,
    onRequest,
    onConfirm,
    onCancel,
  }: DestructiveActionSectionProps) {
    const theme = useEight2FiveTheme();
    return (
      <FormSection title="Destructive actions">
        <SettingInfoCard tone="warning">
          {available
            ? "Unassigning writes passive UWB mode, verifies it, then restores and verifies the PANS default PAN ID 0 used for unassigned devices. The saved device record is kept for retry and diagnostics."
            : "Deleting an offline device removes its saved phone record, snapshots, and position logs without contacting hardware. Rediscovery creates a new unassigned record."}
        </SettingInfoCard>
        {confirmationVisible ? (
          <VStack style={{ gap: eight2FiveSpacing.sm }}>
            <Text
              selectable
              accessibilityRole="alert"
              style={{ color: theme.danger }}
            >
              {available
                ? "Confirm hardware unassignment? UWB will be made passive before the PANS default PAN ID 0 is written."
                : "Confirm deletion of this saved phone record? This cannot be undone."}
            </Text>
            <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
              <Button
                testID="confirm-device-destructive-action"
                variant="destructive"
                isDisabled={busy}
                onPress={onConfirm}
              >
                {busy ? <ButtonSpinner color={theme.raw.white} /> : null}
                <ButtonText>
                  {available ? "Unassign hardware" : "Delete saved device"}
                </ButtonText>
              </Button>
              <Button variant="outline" isDisabled={busy} onPress={onCancel}>
                <ButtonText>Cancel</ButtonText>
              </Button>
            </HStack>
          </VStack>
        ) : (
          <Button
            testID="request-device-destructive-action"
            variant="destructive"
            onPress={onRequest}
          >
            <ButtonText>
              {available ? "Unassign device" : "Delete saved device"}
            </ButtonText>
          </Button>
        )}
      </FormSection>
    );
  },
);
