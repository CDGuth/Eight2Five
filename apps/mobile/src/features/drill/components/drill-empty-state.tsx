import { FileUp } from "lucide-react-native";
import type { DrillTerms } from "@eight2five/mobile/drill";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Center } from "@eight2five/ui/components/center";
import { Heading } from "@eight2five/ui/components/heading";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

export function DrillEmptyState({
  terms,
  onUpload,
}: {
  terms: DrillTerms;
  onUpload(): void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Center style={{ padding: eight2FiveSpacing.xl }}>
      <VStack
        className="items-center"
        style={{ gap: eight2FiveSpacing.md, maxWidth: 420 }}
      >
        <Heading
          className="text-center"
          style={{ color: theme.text, fontFamily: eight2FiveFonts.styleBold }}
        >
          No drills yet
        </Heading>
        <Text className="text-center" style={{ color: theme.textMuted }}>
          Upload an Eight2Five drill file to start working with its{" "}
          {terms.lowercasePlural}.
        </Text>
        <Button
          variant="link"
          onPress={onUpload}
          accessibilityLabel="Upload Drill"
          className="px-0"
        >
          <ButtonIcon as={FileUp} style={{ color: theme.accent }} />
          <ButtonText style={{ color: theme.accent }}>Upload Drill</ButtonText>
        </Button>
      </VStack>
    </Center>
  );
}
