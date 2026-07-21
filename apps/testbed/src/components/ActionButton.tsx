import React from "react";
import { Button, ButtonText } from "@eight2five/ui/components/button";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

interface ActionButtonProps {
  children: string;
  onPress: () => void;
  isDisabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  className?: string;
}

export function ActionButton({
  children,
  onPress,
  isDisabled = false,
  variant = "default",
  className,
}: ActionButtonProps) {
  const theme = useEight2FiveTheme();
  const visual =
    variant === "destructive"
      ? { background: theme.danger, foreground: theme.raw.white }
      : variant === "outline"
        ? { background: theme.accentSoft, foreground: theme.accent }
        : variant === "secondary"
          ? { background: theme.surfaceStrong, foreground: theme.text }
          : variant === "ghost"
            ? { background: "transparent", foreground: theme.accent }
            : { background: theme.accent, foreground: theme.raw.white };

  return (
    <Button
      onPress={onPress}
      isDisabled={isDisabled}
      variant={variant}
      className={`min-h-12 rounded-xl px-5 ${className ?? ""}`}
      style={{
        backgroundColor: visual.background,
        borderWidth: 0,
      }}
    >
      <ButtonText style={{ color: visual.foreground }}>{children}</ButtonText>
    </Button>
  );
}
