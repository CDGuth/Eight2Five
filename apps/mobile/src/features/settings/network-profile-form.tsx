import React from "react";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@eight2five/ui/components/form-control";
import { Input, InputField } from "@eight2five/ui/components/input";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Save } from "lucide-react-native";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing } from "@eight2five/ui/theme";

import type { NetworkDraft, NetworkDraftErrors } from "./network-form";

export function NetworkProfileForm({
  draft,
  errors,
  saving,
  submitLabel,
  onChange,
  onSubmit,
}: {
  readonly draft: NetworkDraft;
  readonly errors: NetworkDraftErrors;
  readonly saving: boolean;
  readonly submitLabel: string;
  readonly onChange: (draft: NetworkDraft) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <VStack style={{ gap: eight2FiveSpacing.md }}>
      <FormControl isInvalid={Boolean(errors.name)}>
        <FormControlLabel>
          <FormControlLabelText>Network name</FormControlLabelText>
        </FormControlLabel>
        <Input isDisabled={saving}>
          <InputField
            testID="network-name-input"
            value={draft.name}
            editable={!saving}
            autoCapitalize="words"
            accessibilityLabel="Network name"
            onChangeText={(name) => onChange({ ...draft, name })}
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText>
            A local name for this PANS network profile.
          </FormControlHelperText>
        </FormControlHelper>
        {errors.name ? (
          <FormControlError accessibilityRole="alert">
            <FormControlErrorText>{errors.name}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <FormControl isInvalid={Boolean(errors.panId)}>
        <FormControlLabel>
          <FormControlLabelText>PAN ID</FormControlLabelText>
        </FormControlLabel>
        <Input isDisabled={saving}>
          <InputField
            testID="network-pan-id-input"
            value={draft.panId}
            editable={!saving}
            autoCapitalize="characters"
            inputMode="text"
            accessibilityLabel="PAN ID"
            onChangeText={(panId) => onChange({ ...draft, panId })}
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText>
            Enter decimal or hexadecimal (for example, 0x1234). PAN 0 is
            reserved for unassigned devices.
          </FormControlHelperText>
        </FormControlHelper>
        {errors.panId ? (
          <FormControlError accessibilityRole="alert">
            <FormControlErrorText>{errors.panId}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <Button
        testID="save-network-button"
        isDisabled={saving}
        onPress={onSubmit}
      >
        {saving ? <ButtonSpinner /> : <ButtonIcon as={Save} />}
        <ButtonText>{submitLabel}</ButtonText>
      </Button>
    </VStack>
  );
}
