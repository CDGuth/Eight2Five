import React from "react";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { FileUp } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Card } from "@eight2five/ui/components/card";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import { SettingsMessage } from "../settings/settings-components";
import {
  EIGHT2FIVE_DRILL_FILE_SUFFIX,
  MAX_DRILL_UPLOAD_BYTES,
  importEight2FiveDrillJson,
  isEight2FiveDrillFileName,
} from "./drill-import";
import { toError } from "./drill-management";

export function DrillUploadScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const snapshot = useAppSettingsSnapshot();
  const store = useAppSettingsStore();
  const [importing, setImporting] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string>();
  const [error, setError] = React.useState<Error>();

  const selectFile = React.useCallback(async () => {
    if (snapshot.status !== "ready" || importing) return;

    setError(undefined);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["application/json", "text/json"],
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      setSelectedFileName(asset.name);
      setImporting(true);
      if (!isEight2FiveDrillFileName(asset.name)) {
        throw new Error(
          `Select a file ending in ${EIGHT2FIVE_DRILL_FILE_SUFFIX}.`,
        );
      }
      if (
        typeof asset.size === "number" &&
        asset.size > MAX_DRILL_UPLOAD_BYTES
      ) {
        throw new Error("The selected drill file is too large to import.");
      }

      const json = await new File(asset.uri).text();
      if (json.length > MAX_DRILL_UPLOAD_BYTES) {
        throw new Error("The selected drill file is too large to import.");
      }

      const drill = await importEight2FiveDrillJson(
        store.getDrillRepository(),
        json,
      );
      router.replace(`/(tabs)/drill/${drill.id}`);
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setImporting(false);
    }
  }, [importing, router, snapshot.status, store]);

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{
        gap: eight2FiveSpacing.md,
        padding: eight2FiveSpacing.md,
        paddingBottom: eight2FiveSpacing.xxl,
      }}
    >
      <Card
        style={{
          gap: eight2FiveSpacing.sm,
          borderColor: theme.border,
          borderRadius: eight2FiveRadii.md,
          backgroundColor: theme.surfaceRaised,
        }}
      >
        <Text style={{ color: theme.text }}>
          Upload an Eight2Five drill file exported as{" "}
          <Text style={{ color: theme.accent }}>
            *{EIGHT2FIVE_DRILL_FILE_SUFFIX}
          </Text>
          .
        </Text>
        <Text style={{ color: theme.textMuted }}>
          The mobile app currently imports one performer on a preset football
          field. Multi-performer drills, props, custom fields, and non-straight
          path geometry are not supported yet.
        </Text>
      </Card>

      {selectedFileName ? (
        <Text selectable style={{ color: theme.textMuted }}>
          Selected: {selectedFileName}
        </Text>
      ) : null}

      {error ? (
        <SettingsMessage tone="error">{error.message}</SettingsMessage>
      ) : null}

      <Button
        onPress={() => void selectFile()}
        isDisabled={snapshot.status !== "ready" || importing}
        accessibilityLabel="Select Eight2Five drill file"
      >
        {importing ? <ButtonSpinner /> : <ButtonIcon as={FileUp} />}
        <ButtonText>
          {importing ? "Importing…" : "Select Drill File"}
        </ButtonText>
      </Button>
    </ScrollView>
  );
}
