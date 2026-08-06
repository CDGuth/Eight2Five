import { FileUp } from "lucide-react-native";
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

export function DrillEmptyState({ onUpload }: { onUpload(): void }) {
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
          Upload an Eight2Five drill file to start working with it.
        </Text>
        <Button
          variant="link"
          size="lg"
          onPress={onUpload}
          accessibilityLabel="Upload Drill"
          className="min-h-12 px-3"
        >
          <ButtonIcon as={FileUp} size="lg" style={{ color: theme.accent }} />
          <ButtonText
            style={{ color: theme.accent, fontSize: 17, lineHeight: 22 }}
          >
            Upload Drill
          </ButtonText>
        </Button>
      </VStack>
    </Center>
  );
}
