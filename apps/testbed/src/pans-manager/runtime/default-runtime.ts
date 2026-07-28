import type {
  PansManagerRuntime,
  RuntimeStatusReporter,
} from "../manager-context";

export async function createDefaultPansManagerRuntime(
  reporter: RuntimeStatusReporter,
): Promise<PansManagerRuntime> {
  // Keep native loading lazy so registry tests can render without a dev client.
  const manager = await import("@eight2five/mobile/pans-manager");
  reporter.module("ready");
  reporter.storage("opening");
  const storage = await manager.openPansManagerRepository();
  try {
    await storage.repository.initialize();
    reporter.storage("ready");
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
    const logs = new manager.PansPositionLogService(storage.repository, {
      memoryCap: settings.positionLogMemoryCap,
      flushSize: settings.positionLogFlushSize,
    });
    const configuration = new manager.PansConfigurationService(
      sessions,
      storage.repository,
    );
    const batch = new manager.PansBatchOperationService(storage.repository);
    return {
      repository: storage.repository,
      discovery,
      sessions,
      configuration,
      commissioning: new manager.PansCommissioningService(
        storage.repository,
        configuration,
        Date.now,
        batch,
      ),
      diagnostics: new manager.PansDiagnosticsService(sessions),
      batch,
      logs,
      topology: new manager.PansTopologyService(sessions),
      createPositionStream: () =>
        new manager.PansPositionStreamService(sessions),
      networkExport: new manager.PansNetworkExportService(storage.repository),
      closeStorage: storage.close,
    };
  } catch (error) {
    reporter.storage("error");
    await storage.close();
    throw error;
  }
}
