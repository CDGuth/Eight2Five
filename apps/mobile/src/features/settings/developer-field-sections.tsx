import React from "react";
import {
  CircleDotDashed,
  Crosshair,
  Grid3X3,
  MapPinned,
} from "lucide-react-native";
import {
  MAX_PERIMETER_GRID_YARD_LINE_COUNT,
  MIN_PERIMETER_GRID_YARD_LINE_COUNT,
} from "@eight2five/mobile/settings";
import { Button, ButtonText } from "@eight2five/ui/components/button";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing } from "@eight2five/ui/theme";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import { parseComfortableAnchorRange } from "./comfortable-anchor-range";
import { AnchorNumberInput } from "./standard-anchor-position-form";
import {
  SettingsMessage,
  SettingsSection,
  SettingsSelectRow,
  SettingsSwitchRow,
} from "./settings-components";

const PERIMETER_YARD_LINE_CHOICES = Array.from(
  {
    length:
      MAX_PERIMETER_GRID_YARD_LINE_COUNT -
      MIN_PERIMETER_GRID_YARD_LINE_COUNT +
      1,
  },
  (_, offset) => {
    const count = MIN_PERIMETER_GRID_YARD_LINE_COUNT + offset;
    return {
      label: count === 1 ? "1 yard line" : `${count} yard lines`,
      value: String(count),
    };
  },
);

export function DeveloperMockPositionSection() {
  const store = useAppSettingsStore();
  const { settings } = useAppSettingsSnapshot();
  const [error, setError] = React.useState<Error>();
  const [mockXDraft, setMockXDraft] = React.useState(() =>
    settings.mockLivePositionXSteps.toString(),
  );
  const [mockYDraft, setMockYDraft] = React.useState(() =>
    settings.mockLivePositionYSteps.toString(),
  );
  const mockX = parseStaticPositionCoordinate(mockXDraft);
  const mockY = parseStaticPositionCoordinate(mockYDraft);

  const update = async (changes: Parameters<typeof store.update>[0]) => {
    setError(undefined);
    try {
      await store.update(changes);
    } catch (cause) {
      setError(toError(cause));
    }
  };

  return (
    <>
      {error ? (
        <SettingsMessage tone="error">{error.message}</SettingsMessage>
      ) : null}
      <SettingsSection title="Live Position Mock">
        <SettingsSwitchRow
          icon={Crosshair}
          title="Mock live position"
          description="Replace the field UI's live position with a fixed development coordinate. Hardware status remains real."
          value={settings.mockLivePositionEnabled}
          onChange={(mockLivePositionEnabled) =>
            void update({ mockLivePositionEnabled })
          }
          testID="mock-live-position-setting"
        />
        {settings.mockLivePositionEnabled ? (
          <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
            <AnchorNumberInput
              label="X (8-to-5 steps from 50)"
              value={mockXDraft}
              error={mockX.error}
              helper="Negative is Side 1; positive is Side 2 when viewed from the front sideline."
              disabled={false}
              onChange={setMockXDraft}
            />
            <AnchorNumberInput
              label="Y (8-to-5 steps from front sideline)"
              value={mockYDraft}
              error={mockY.error}
              helper="Zero is the front sideline; positive values move toward the back sideline."
              disabled={false}
              onChange={setMockYDraft}
            />
            <Button
              variant="outline"
              testID="apply-mock-live-position-button"
              isDisabled={
                mockX.value === undefined ||
                mockY.value === undefined ||
                (mockX.value === settings.mockLivePositionXSteps &&
                  mockY.value === settings.mockLivePositionYSteps)
              }
              onPress={() => {
                if (mockX.value === undefined || mockY.value === undefined)
                  return;
                void update({
                  mockLivePositionXSteps: mockX.value,
                  mockLivePositionYSteps: mockY.value,
                });
              }}
            >
              <ButtonText>Apply Mock Position</ButtonText>
            </Button>
          </VStack>
        ) : null}
      </SettingsSection>
    </>
  );
}

export function DeveloperFieldOverlaySection() {
  const store = useAppSettingsStore();
  const { settings } = useAppSettingsSnapshot();
  const [error, setError] = React.useState<Error>();
  const [rangeDraft, setRangeDraft] = React.useState(() =>
    settings.comfortableAnchorRangeMeters.toString(),
  );
  const rangeValidation = parseComfortableAnchorRange(rangeDraft);

  const update = async (changes: Parameters<typeof store.update>[0]) => {
    setError(undefined);
    try {
      await store.update(changes);
    } catch (cause) {
      setError(toError(cause));
    }
  };

  return (
    <>
      {error ? (
        <SettingsMessage tone="error">{error.message}</SettingsMessage>
      ) : null}
      <SettingsSection title="Field Overlays">
        <SettingsSwitchRow
          icon={Grid3X3}
          title="Show perimeter step grid"
          description="Continue the active marching coordinate grid beyond the physical field boundary."
          value={settings.showPerimeterStepGrid}
          onChange={(showPerimeterStepGrid) =>
            void update({ showPerimeterStepGrid })
          }
          testID="show-perimeter-step-grid-setting"
        />
        <SettingsSelectRow<string>
          icon={Grid3X3}
          title="Perimeter grid yard lines"
          description="Choose how many five-yard lines of the 8:5 step grid extend beyond each field boundary."
          value={String(settings.perimeterGridYardLineCount)}
          choices={PERIMETER_YARD_LINE_CHOICES}
          onChange={(value) =>
            void update({ perimeterGridYardLineCount: Number(value) })
          }
          disabled={!settings.showPerimeterStepGrid}
          testID="perimeter-grid-yard-line-count-setting"
        />
        <SettingsSwitchRow
          icon={MapPinned}
          title="Show cached anchor geometry"
          description="Draw locally cached anchors for the selected drill field."
          value={settings.showCachedAnchorGeometry}
          onChange={(showCachedAnchorGeometry) =>
            void update({ showCachedAnchorGeometry })
          }
          testID="show-cached-anchor-geometry-setting"
        />
        <SettingsSwitchRow
          icon={CircleDotDashed}
          title="Show comfortable anchor range"
          description="Draw an approximate planning range, not guaranteed RF coverage."
          value={
            settings.showCachedAnchorGeometry &&
            settings.showComfortableAnchorRange
          }
          onChange={(showComfortableAnchorRange) =>
            void update({ showComfortableAnchorRange })
          }
          disabled={!settings.showCachedAnchorGeometry}
          testID="show-comfortable-anchor-range-setting"
        />
        <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
          <AnchorNumberInput
            label="Comfortable range (meters)"
            value={rangeDraft}
            error={rangeValidation.error}
            helper="Stored in meters. Must be greater than 0 and no more than 200 m."
            disabled={!settings.showCachedAnchorGeometry}
            onChange={setRangeDraft}
          />
          <Button
            variant="outline"
            testID="apply-comfortable-anchor-range-button"
            isDisabled={
              !settings.showCachedAnchorGeometry ||
              rangeValidation.value === undefined ||
              rangeValidation.value === settings.comfortableAnchorRangeMeters
            }
            onPress={() => {
              if (rangeValidation.value !== undefined) {
                void update({
                  comfortableAnchorRangeMeters: rangeValidation.value,
                });
              }
            }}
          >
            <ButtonText>Apply Comfortable Range</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>
    </>
  );
}

export function parseStaticPositionCoordinate(value: string): {
  readonly value?: number;
  readonly error?: string;
} {
  const normalized = value.trim();
  if (!normalized) return { error: "Enter a coordinate." };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { error: "Enter a finite number." };
  if (Math.abs(parsed) > 1000) {
    return { error: "Enter a value between -1000 and 1000 steps." };
  }
  return { value: parsed };
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
