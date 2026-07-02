import React from "react";
import { Text } from "@eight2five/ui/text";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="sm" bold className="mb-3 text-foreground">
      {children}
    </Text>
  );
}
