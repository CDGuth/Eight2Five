import React from "react";
import { VStack } from "@eight2five/ui/components/vstack";
import { Heading } from "@eight2five/ui/components/heading";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveFonts } from "@eight2five/ui/theme";
import { SubappCard } from "../components/SubappCard";
import { SUBAPPS, SubappId, TestbedSubapp } from "../subapps";

interface TestbedHomeProps {
  subapps?: readonly TestbedSubapp[];
  onSelect: (id: SubappId) => void;
}

export function TestbedHome({ subapps = SUBAPPS, onSelect }: TestbedHomeProps) {
  return (
    <VStack className="flex-1 gap-4">
      <VStack className="gap-1">
        <Heading size="2xl">Eight2Five Testbed App</Heading>
        <Text style={{ fontFamily: eight2FiveFonts.utilityRegular }}>
          Select a subapp to run.
        </Text>
      </VStack>
      {subapps.map((entry) => (
        <SubappCard
          key={entry.id}
          title={entry.title}
          description={entry.description}
          badge={entry.badge}
          onPress={() => onSelect(entry.id)}
        />
      ))}
    </VStack>
  );
}
