import React from "react";
import {
  Button,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
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
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing } from "@eight2five/ui/theme";

import { DRILL_NAME_MAX_LENGTH, validateDrillName } from "../drill-management";

export function DrillNameForm({
  initialValue = "",
  submitLabel,
  saving,
  onSubmit,
}: {
  initialValue?: string;
  submitLabel: string;
  saving: boolean;
  onSubmit(name: string): Promise<void>;
}) {
  const [name, setName] = React.useState(initialValue);
  const [error, setError] = React.useState<string>();
  const submittingRef = React.useRef(false);

  const submit = async () => {
    if (saving || submittingRef.current) return;
    const validationError = validateDrillName(name);
    setError(validationError);
    if (validationError) return;
    submittingRef.current = true;
    try {
      await onSubmit(name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <VStack style={{ gap: eight2FiveSpacing.md }}>
      <FormControl isInvalid={Boolean(error)} isRequired>
        <FormControlLabel>
          <FormControlLabelText>Drill name</FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField
            testID="drill-name-input"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(undefined);
            }}
            autoCapitalize="words"
            autoCorrect
            maxLength={DRILL_NAME_MAX_LENGTH}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => void submit()}
            accessibilityLabel="Drill name"
          />
        </Input>
        <FormControlHelper>
          <FormControlHelperText>
            Up to {DRILL_NAME_MAX_LENGTH} characters.
          </FormControlHelperText>
        </FormControlHelper>
        <FormControlError accessibilityRole="alert">
          <FormControlErrorText>{error}</FormControlErrorText>
        </FormControlError>
      </FormControl>
      <Button
        testID="save-drill-name"
        onPress={() => void submit()}
        isDisabled={saving}
        accessibilityState={{ busy: saving, disabled: saving }}
      >
        {saving ? <ButtonSpinner /> : null}
        <ButtonText>{submitLabel}</ButtonText>
      </Button>
    </VStack>
  );
}
