import React from "react";

import { CollapsibleSection } from "../components/CollapsibleSection";
import { InputRow } from "../components/InputRow";

interface PropagationSectionProps {
  txHeight: string;
  setTxHeight: (v: string) => void;
  rxHeight: string;
  setRxHeight: (v: string) => void;
  freq: string;
  setFreq: (v: string) => void;
  txGain: string;
  setTxGain: (v: string) => void;
  rxGain: string;
  setRxGain: (v: string) => void;
  refCoeff: string;
  setRefCoeff: (v: string) => void;
}

export function PropagationSection({
  txHeight,
  setTxHeight,
  rxHeight,
  setRxHeight,
  freq,
  setFreq,
  txGain,
  setTxGain,
  rxGain,
  setRxGain,
  refCoeff,
  setRefCoeff,
}: PropagationSectionProps) {
  return (
    <CollapsibleSection title="Propagation Constants">
      <InputRow
        label="Tx Height (m)"
        value={txHeight}
        onChange={setTxHeight}
        tooltip="Height of the transmitter (beacon) in meters. In the Two-Ray model, this determines the destructive interference patterns."
      />
      <InputRow
        label="Rx Height (m)"
        value={rxHeight}
        onChange={setRxHeight}
        tooltip="Height of the receiver (mobile device) in meters. This is the height at which the performer carries their phone."
      />
      <InputRow
        label="Frequency (Hz)"
        value={freq}
        onChange={setFreq}
        tooltip="Operating frequency in Hertz. Standard Bluetooth Low Energy operates at 2.4e9 Hz (2.4 GHz)."
      />
      <InputRow
        label="Tx Gain"
        value={txGain}
        onChange={setTxGain}
        tooltip="Transmitter antenna gain (linear scale). A value of 1.0 represents an isotropic antenna."
      />
      <InputRow
        label="Rx Gain"
        value={rxGain}
        onChange={setRxGain}
        tooltip="Receiver antenna gain (linear scale). Combined with Tx Gain, this scales the overall received power."
      />
      <InputRow
        label="Reflection Coeff"
        value={refCoeff}
        onChange={setRefCoeff}
        tooltip="Ground reflection coefficient (0 to 1). A value of 1.0 represents a perfect reflector (typical for flat asphalt or concrete)."
      />
    </CollapsibleSection>
  );
}
