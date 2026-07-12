import type { PansManagerRepository } from "./PansManagerRepository";
import { PansConfigurationService } from "./PansConfigurationService";
import type {
  ManagedDevice,
  ManagedDeviceConfig,
  ManagedNetwork,
  PansConfigurationResult,
} from "./types";
import { assertPanId, assertUniqueName } from "./validation";

export interface PansCommissioningDevice {
  device: ManagedDevice;
  config: ManagedDeviceConfig;
}

export interface PansCommissioningResult {
  network: ManagedNetwork;
  results: PansConfigurationResult[];
}

/** Coordinates persistence and configuration without bypassing the session boundary. */
export class PansCommissioningService {
  constructor(
    private readonly repository: PansManagerRepository,
    private readonly configuration: PansConfigurationService,
    private readonly now: () => number = Date.now,
  ) {}

  async commissionNetwork(
    network: ManagedNetwork,
    devices: PansCommissioningDevice[],
  ): Promise<PansCommissioningResult> {
    assertPanId(network.panId);
    const existing = await this.repository.listNetworks();
    assertUniqueName(
      network.name,
      existing.map((item) => item.name),
      existing.find((item) => item.id === network.id)?.name,
    );
    await this.repository.saveNetwork(network);
    const results: PansConfigurationResult[] = [];
    for (const entry of devices) {
      await this.repository.saveDevice({
        ...entry.device,
        networkId: network.id,
      });
      await this.repository.associateDevice({
        networkId: network.id,
        deviceId: entry.device.id,
        associatedAt: this.now(),
      });
      results.push(
        await this.configuration.configureDevice(entry.device.id, {
          ...entry.config,
          panId: entry.config.panId ?? network.panId,
        }),
      );
    }
    return { network, results };
  }
}
