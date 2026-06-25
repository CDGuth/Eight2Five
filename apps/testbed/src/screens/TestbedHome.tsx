import React from "react";
import { VStack } from "@eight2five/ui/vstack";
import { SubappCard } from "../components/SubappCard";
import { SUBAPPS, SubappId, TestbedSubapp } from "../subapps";

interface TestbedHomeProps {
  subapps?: TestbedSubapp[];
  onSelect: (id: SubappId) => void;
}

export function TestbedHome({ subapps = SUBAPPS, onSelect }: TestbedHomeProps) {
  return (
    <VStack className="flex-1">
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
