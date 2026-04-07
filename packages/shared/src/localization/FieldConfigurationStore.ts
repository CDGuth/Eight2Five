import { FieldConfiguration, FieldConfigurationStore } from "./types";

export function createInMemoryFieldConfigurationStore(
  initialConfigurations: FieldConfiguration[] = [],
): FieldConfigurationStore {
  const map = new Map<string, FieldConfiguration>(
    initialConfigurations.map((config) => [config.id, config]),
  );

  return {
    getFieldConfiguration(fieldId: string) {
      return map.get(fieldId);
    },
    setFieldConfiguration(config: FieldConfiguration) {
      map.set(config.id, config);
    },
    listFieldConfigurations() {
      return Array.from(map.values());
    },
    removeFieldConfiguration(fieldId: string) {
      map.delete(fieldId);
    },
  };
}
