import { NotebookTabs, Plus } from "lucide-react-native";
import type { DrillTerms } from "@eight2five/mobile/drill";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Center } from "@eight2five/ui/components/center";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

export function DrillEmptyState({
  terms,
  onCreate,
}: {
  terms: DrillTerms;
  onCreate(): void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <Center style={{ padding: eight2FiveSpacing.xl }}>
      <VStack
        className="items-center"
        style={{ gap: eight2FiveSpacing.md, maxWidth: 420 }}
      >
        <Icon as={NotebookTabs} size="xl" style={{ color: theme.accent }} />
        <Heading
          className="text-center"
          style={{ color: theme.text, fontFamily: eight2FiveFonts.styleBold }}
        >
          No drills yet
        </Heading>
        <Text className="text-center" style={{ color: theme.textMuted }}>
          Drills are entered manually. Create one to start adding{" "}
          {terms.lowercasePlural}.
        </Text>
        <Button onPress={onCreate} accessibilityLabel="Create Drill">
          <ButtonIcon as={Plus} />
          <ButtonText>Create Drill</ButtonText>
        </Button>
      </VStack>
    </Center>
  );
}
