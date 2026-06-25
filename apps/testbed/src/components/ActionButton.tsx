import React from "react";
import { Button, ButtonText } from "@eight2five/ui/button";

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
  return (
    <Button
      onPress={onPress}
      isDisabled={isDisabled}
      variant={variant}
      className={className}
    >
      <ButtonText>{children}</ButtonText>
    </Button>
  );
}
