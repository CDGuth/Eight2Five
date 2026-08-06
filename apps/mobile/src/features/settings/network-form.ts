import {
  assertNetworkProfilePanId,
  assertUniqueName,
  parsePanId,
  type ManagedNetwork,
} from "@eight2five/mobile/pans-manager";

export interface NetworkDraft {
  readonly name: string;
  readonly panId: string;
}

export interface NetworkDraftErrors {
  readonly name?: string;
  readonly panId?: string;
}

export interface ValidatedNetworkDraft {
  readonly name: string;
  readonly panId: number;
}

export interface NetworkDraftValidation {
  readonly errors: NetworkDraftErrors;
  readonly value?: ValidatedNetworkDraft;
}

/**
 * Validates the small app-local network profile form before it reaches the
 * store. The store remains the authority for persistence and validates again;
 * this keeps incomplete forms from starting an asynchronous operation.
 */
export function validateNetworkDraft(
  draft: NetworkDraft,
  networks: readonly ManagedNetwork[] = [],
  currentNetworkId?: string,
): NetworkDraftValidation {
  const errors: { name?: string; panId?: string } = {};
  const name = draft.name.trim();

  if (!name) {
    errors.name = "Enter a network name.";
  } else {
    const currentName = networks.find(
      (network) => network.id === currentNetworkId,
    )?.name;
    try {
      assertUniqueName(
        name,
        networks.map((network) => network.name),
        currentName,
      );
    } catch (cause) {
      errors.name = toMessage(cause, "That network name is already in use.");
    }
  }

  let panId: number | undefined;
  try {
    panId = parsePanId(draft.panId);
    assertNetworkProfilePanId(panId);
  } catch (cause) {
    errors.panId = toMessage(cause, "Enter a PAN ID from 1 to 65535.");
  }

  if (
    panId !== undefined &&
    networks.some(
      (network) => network.id !== currentNetworkId && network.panId === panId,
    )
  ) {
    errors.panId = "A network with this PAN ID already exists.";
  }

  return Object.keys(errors).length > 0
    ? { errors }
    : { errors, value: { name, panId: panId! } };
}

export function networkDraftFromNetwork(network: ManagedNetwork): NetworkDraft {
  return { name: network.name, panId: String(network.panId) };
}

function toMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
