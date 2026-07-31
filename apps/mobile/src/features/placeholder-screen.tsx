import { Center } from "@eight2five/ui/components/center";
import { Heading } from "@eight2five/ui/components/heading";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

export function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const theme = useEight2FiveTheme();

  return (
    <Center
      className="flex-1"
      style={{
        backgroundColor: theme.background,
        padding: eight2FiveSpacing.lg,
      }}
    >
      <VStack style={{ gap: eight2FiveSpacing.sm }}>
        <Heading
          className="text-center"
          style={{ color: theme.text, fontFamily: eight2FiveFonts.styleBold }}
        >
          {title}
        </Heading>
        <Text
          className="text-center"
          style={{
            color: theme.textMuted,
            fontFamily: eight2FiveFonts.utilityRegular,
          }}
        >
          {description}
        </Text>
      </VStack>
    </Center>
  );
}
