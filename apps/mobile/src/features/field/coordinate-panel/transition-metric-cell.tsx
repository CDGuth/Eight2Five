import { Box } from "@eight2five/ui/components/box";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";

export function TransitionMetricCell({
  label,
  value,
  disabled,
  onToggle,
}: {
  readonly label: "Step Size" | "xCounts";
  readonly value: string;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}) {
  const stepSizeSelected = label === "Step Size";
  return (
    <Pressable
      accessibilityLabel={`${label}, ${value}. Toggle transition metric.`}
      accessibilityRole="button"
      disabled={disabled}
      className="min-h-12 min-w-12 flex-1 justify-center px-2"
      onPress={onToggle}
      testID="transition-metric-toggle"
    >
      <VStack className="items-center" style={{ gap: 1 }}>
        <Text size="xs" style={{ color: "rgba(255,255,255,0.56)" }}>
          {label}
        </Text>
        <Text
          numberOfLines={1}
          selectable
          size="sm"
          style={{ color: "#FFFFFF", fontVariant: ["tabular-nums"] }}
        >
          {value}
        </Text>
        <VStack style={{ gap: 2, position: "absolute", right: 0, top: 4 }}>
          <Box
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: stepSizeSelected
                ? "#FFFFFF"
                : "rgba(255,255,255,0.32)",
            }}
          />
          <Box
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: stepSizeSelected
                ? "rgba(255,255,255,0.32)"
                : "#FFFFFF",
            }}
          />
        </VStack>
      </VStack>
    </Pressable>
  );
}
