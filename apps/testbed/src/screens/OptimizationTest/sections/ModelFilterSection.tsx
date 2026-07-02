import React from "react";

import { CollapsibleSection } from "../components/CollapsibleSection";
import { Dropdown } from "../components/Dropdown";

interface ModelFilterSectionProps {
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  selectedFilter: string;
  setSelectedFilter: (v: string) => void;
  onToggleScroll: (open: boolean) => void;
}

export function ModelFilterSection({
  selectedModel,
  setSelectedModel,
  selectedFilter,
  setSelectedFilter,
  onToggleScroll,
}: ModelFilterSectionProps) {
  return (
    <CollapsibleSection title="Model & Filter">
      <Dropdown
        label="Propagation Model"
        value={selectedModel}
        options={[
          { label: "Two Ray Ground", value: "TwoRayGround" },
          { label: "Log Normal", value: "LogNormal" },
        ]}
        onSelect={setSelectedModel}
        onToggle={onToggleScroll}
        tooltip="The mathematical model used to predict RSSI from distance. Two Ray Ground is better for outdoors; Log Normal is standard for indoors."
      />
      <Dropdown
        label="RSSI Filter"
        value={selectedFilter}
        options={[{ label: "Kalman", value: "Kalman" }]}
        onSelect={setSelectedFilter}
        onToggle={onToggleScroll}
        tooltip="The filtering algorithm applied to raw simulated measurements. Kalman filtering smooths out noise peaks based on process/measurement variance."
      />
    </CollapsibleSection>
  );
}
