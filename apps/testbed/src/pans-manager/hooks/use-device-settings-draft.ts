import React from "react";
import type {
  ManagedDevice,
  PansConfigurationResult,
  PansInspectionResult,
} from "@eight2five/mobile/pans-manager";
import {
  convertMapInputText,
  mapUnitsToMeters,
} from "@eight2five/mobile/pans-manager";

import {
  buildDeviceConfigurationDiff,
  deviceSettingsFormFrom,
  mergeInspectionIntoDeviceSettingsForm,
  validateAnchorPositionFields,
  type DeviceSettingsFormValues,
} from "../device-settings-form";

export interface PositionInputs {
  x: string;
  y: string;
  z: string;
}
type MapUnits = "metric" | "imperial";

export function useDeviceSettingsDraft({
  device,
  advertisedName,
  isOpen,
  mapUnits,
}: {
  device?: ManagedDevice;
  advertisedName?: string;
  isOpen: boolean;
  mapUnits: MapUnits;
}) {
  const [baseline, setBaseline] = React.useState<DeviceSettingsFormValues>();
  const [form, setForm] = React.useState<DeviceSettingsFormValues>();
  const [positionInputs, setPositionInputs] = React.useState<PositionInputs>({
    x: "",
    y: "",
    z: "",
  });
  const loadedDeviceId = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!isOpen || !device || loadedDeviceId.current === device.id) return;
    loadedDeviceId.current = device.id;
    const initial = deviceSettingsFormFrom(device, advertisedName);
    setBaseline(initial);
    setForm(initial);
    setPositionInputs(positionInputsFromForm(initial, mapUnits));
  }, [advertisedName, device, isOpen, mapUnits]);
  React.useEffect(() => {
    if (!isOpen) loadedDeviceId.current = undefined;
  }, [isOpen]);

  const updateField = React.useCallback(
    <K extends keyof DeviceSettingsFormValues>(
      field: K,
      value: DeviceSettingsFormValues[K],
    ) => {
      setForm((current) =>
        current ? { ...current, [field]: value } : current,
      );
    },
    [],
  );
  const updatePosition = React.useCallback(
    (field: keyof PositionInputs, value: string) => {
      setPositionInputs((current) => ({ ...current, [field]: value }));
    },
    [],
  );
  const mergeInspection = React.useCallback(
    (inspection: PansInspectionResult) => {
      if (loadedDeviceId.current !== inspection.deviceId) return;
      setForm((current) =>
        current
          ? mergeInspectionIntoDeviceSettingsForm(current, inspection)
          : current,
      );
      setBaseline((current) =>
        current
          ? mergeInspectionIntoDeviceSettingsForm(current, inspection)
          : current,
      );
    },
    [],
  );

  const saveForm = React.useMemo(
    () =>
      form?.role === "anchor"
        ? {
            ...form,
            positionX: positionInputToCanonical(positionInputs.x, mapUnits),
            positionY: positionInputToCanonical(positionInputs.y, mapUnits),
            positionZ: positionInputToCanonical(positionInputs.z, mapUnits),
          }
        : form,
    [form, mapUnits, positionInputs],
  );
  const errors = React.useMemo(
    () =>
      validatePositionValues(
        saveForm?.role,
        saveForm?.positionX,
        saveForm?.positionY,
        saveForm?.positionZ,
        saveForm?.positionQuality,
      ),
    [
      saveForm?.positionQuality,
      saveForm?.positionX,
      saveForm?.positionY,
      saveForm?.positionZ,
      saveForm?.role,
    ],
  );
  const hasErrors = Object.values(errors).some(Boolean);
  const diff = React.useMemo(
    () =>
      baseline && saveForm && !hasErrors
        ? buildDeviceConfigurationDiff(baseline, saveForm)
        : undefined,
    [baseline, hasErrors, saveForm],
  );
  const dirty = Boolean(
    diff &&
    (Object.keys(diff.hardwareChanges).length ||
      Object.keys(diff.localChanges).length),
  );

  const applySaveResult = React.useCallback(
    (result: PansConfigurationResult) => {
      if (!result.inspected) return;
      setForm((current) => {
        if (!current) return current;
        const canonical =
          current.role === "anchor"
            ? {
                ...current,
                positionX: positionInputToCanonical(positionInputs.x, mapUnits),
                positionY: positionInputToCanonical(positionInputs.y, mapUnits),
                positionZ: positionInputToCanonical(positionInputs.z, mapUnits),
              }
            : current;
        const merged = mergeInspectionIntoDeviceSettingsForm(
          canonical,
          result.inspected!,
        );
        setPositionInputs(positionInputsFromForm(merged, mapUnits));
        return merged;
      });
      setBaseline((current) => {
        if (!current) return current;
        let merged = mergeInspectionIntoDeviceSettingsForm(
          current,
          result.inspected!,
        );
        if (
          result.writes.some(
            (write) =>
              write.field === "position" &&
              write.status === "written-unverified",
          )
        ) {
          merged = {
            ...merged,
            positionX: positionInputToCanonical(positionInputs.x, mapUnits),
            positionY: positionInputToCanonical(positionInputs.y, mapUnits),
            positionZ: positionInputToCanonical(positionInputs.z, mapUnits),
            positionQuality: form?.positionQuality ?? "",
          };
        }
        return merged;
      });
    },
    [form?.positionQuality, mapUnits, positionInputs],
  );

  return {
    baseline,
    form,
    positionInputs,
    saveForm,
    errors,
    hasErrors,
    diff,
    dirty,
    updateField,
    updatePosition,
    mergeInspection,
    applySaveResult,
  };
}

function positionInputsFromForm(
  form: DeviceSettingsFormValues,
  units: MapUnits,
): PositionInputs {
  return {
    x: convertMapInputText(form.positionX ?? "", "metric", units, 9),
    y: convertMapInputText(form.positionY ?? "", "metric", units, 9),
    z: convertMapInputText(form.positionZ ?? "", "metric", units, 9),
  };
}

function positionInputToCanonical(value: string, units: MapUnits): string {
  const text = value.trim();
  if (!text) return "";
  const parsed = Number(text);
  return Number.isFinite(parsed)
    ? String(mapUnitsToMeters(parsed, units))
    : value;
}

function validatePositionValues(
  role: DeviceSettingsFormValues["role"],
  positionX?: string,
  positionY?: string,
  positionZ?: string,
  positionQuality?: string,
) {
  return role === "anchor"
    ? validateAnchorPositionFields({
        role,
        positionX,
        positionY,
        positionZ,
        positionQuality,
        source: "cached",
        unavailableHardwareFields: [],
      })
    : {};
}
