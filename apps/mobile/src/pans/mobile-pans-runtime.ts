import type {
  PansConfigurationService,
  PansCommissioningService,
  PansDeviceSessionManager,
  PansDiagnosticsService,
  PansDiscoveryService,
  PansManagerRepository,
  PansPositionStreamService,
} from "@eight2five/mobile/pans-manager";

export interface MobilePansRuntime {
  readonly repository: PansManagerRepository;
  readonly discovery: PansDiscoveryService;
  readonly sessions: PansDeviceSessionManager;
  readonly stream: PansPositionStreamService;
  readonly configuration: PansConfigurationService;
  readonly commissioning: PansCommissioningService;
  readonly diagnostics: PansDiagnosticsService;
  close(): Promise<void>;
}

export type CreateMobilePansRuntime = () => Promise<MobilePansRuntime>;

export const createDefaultMobilePansRuntime: CreateMobilePansRuntime =
  async () => {
    // The native module is unavailable in Expo Go and registry-style tests.
    // Keep it lazy so the app can surface initialization failure safely.
    const manager = await import("@eight2five/mobile/pans-manager");
    const storage = await manager.openPansManagerRepository();
    try {
      await storage.repository.initialize();
      const settings = manager.normalizePansManagerSettings(
        await storage.repository.getSettings(),
      );
      const discovery = new manager.PansDiscoveryService(undefined, {
        staleAfterMs: settings.discoveryStaleAfterMs,
      });
      const sessions = new manager.PansDeviceSessionManager(
        undefined,
        settings.connectionTimeoutMs,
      );
      const configuration = new manager.PansConfigurationService(
        sessions,
        storage.repository,
      );
      return {
        repository: storage.repository,
        discovery,
        sessions,
        stream: new manager.PansPositionStreamService(sessions),
        configuration,
        commissioning: new manager.PansCommissioningService(
          storage.repository,
          configuration,
        ),
        diagnostics: new manager.PansDiagnosticsService(sessions),
        close: async () => {
          await discovery.stop().catch(() => undefined);
          await sessions.closeAll().catch(() => undefined);
          await storage.close();
        },
      };
    } catch (error) {
      await storage.close();
      throw error;
    }
  };
