export interface TagDiscoveryPageOwner {
  startTagDiscovery(): Promise<void>;
  stopManualDiscovery(): void;
}

export function ownTagDiscoveryWhileFocused(
  store: TagDiscoveryPageOwner,
  servicesReady: boolean,
  alreadyConnected: boolean,
  onError: (error: Error) => void,
): () => void {
  if (servicesReady && !alreadyConnected) {
    void store
      .startTagDiscovery()
      .catch((cause) =>
        onError(cause instanceof Error ? cause : new Error(String(cause))),
      );
  }
  return () => store.stopManualDiscovery();
}
