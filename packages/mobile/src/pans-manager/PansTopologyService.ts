import { normalizeManagerError } from "./errors";
import { PansDeviceSessionManager } from "./PansDeviceSessionManager";
import type {
  ManagedDevice,
  ObservedPansTopology,
  ObservedTopologyEdge,
  ObservedTopologyNode,
  PansTopologyObservation,
} from "./types";

const UNCERTAINTY =
  "Observed edges report only neighbors returned during this refresh. A missing edge does not prove that two devices cannot communicate.";

export class PansTopologyService {
  constructor(
    private readonly sessions: PansDeviceSessionManager,
    private readonly now: () => number = Date.now,
  ) {}

  async refresh(devices: ManagedDevice[]): Promise<ObservedPansTopology> {
    const observations: PansTopologyObservation[] = [];
    // Deliberately sequential: DWM1001 reads and connections are not multiplexed.
    for (const device of devices) {
      const errors: string[] = [];
      try {
        const observation = await this.sessions.withConnectedDevice(
          device.transportDeviceId,
          async (session) => {
            let anchorList: PansTopologyObservation["anchorList"];
            let clusterInfo: PansTopologyObservation["clusterInfo"];
            try {
              anchorList = await session.readAnchorList();
            } catch (error) {
              errors.push(normalizeManagerError(error).message);
            }
            try {
              clusterInfo = await session.readClusterInfo();
            } catch (error) {
              errors.push(normalizeManagerError(error).message);
            }
            return { anchorList, clusterInfo };
          },
        );
        observations.push({
          deviceId: device.id,
          transportDeviceId: device.transportDeviceId,
          observedAt: this.now(),
          ...(device.nodeIdHex ? { localNodeIdHex: device.nodeIdHex } : {}),
          ...(observation.anchorList
            ? { anchorList: observation.anchorList }
            : {}),
          ...(observation.clusterInfo
            ? { clusterInfo: observation.clusterInfo }
            : {}),
          errors,
        });
      } catch (error) {
        observations.push({
          deviceId: device.id,
          transportDeviceId: device.transportDeviceId,
          observedAt: this.now(),
          ...(device.nodeIdHex ? { localNodeIdHex: device.nodeIdHex } : {}),
          errors: [normalizeManagerError(error).message],
        });
      }
    }
    return deriveObservedTopology(observations, this.now());
  }
}

export function deriveObservedTopology(
  observations: PansTopologyObservation[],
  observedAt = Date.now(),
): ObservedPansTopology {
  const nodes = new Map<string, ObservedTopologyNode>();
  const edges: ObservedTopologyEdge[] = [];
  const localByNodeId = new Map(
    observations
      .filter((item) => item.localNodeIdHex)
      .map((item) => [normalizeNodeId(item.localNodeIdHex!), item.deviceId]),
  );

  for (const observation of observations) {
    const sourceKey = observation.localNodeIdHex
      ? `node:${normalizeNodeId(observation.localNodeIdHex)}`
      : `device:${observation.deviceId}`;
    upsertNode(nodes, sourceKey, {
      ...(observation.localNodeIdHex
        ? { nodeIdHex: normalizeNodeId(observation.localNodeIdHex) }
        : {}),
      localDeviceId: observation.deviceId,
      observedByDeviceId: observation.deviceId,
    });

    for (const anchor of observation.anchorList?.anchors ?? []) {
      const nodeIdHex = normalizeNodeId(anchor.nodeIdHex);
      const targetKey = `node:${nodeIdHex}`;
      upsertNode(nodes, targetKey, {
        nodeIdHex,
        ...(localByNodeId.get(nodeIdHex)
          ? { localDeviceId: localByNodeId.get(nodeIdHex) }
          : {}),
        observedByDeviceId: observation.deviceId,
      });
      edges.push({
        sourceKey,
        targetKey,
        observedByDeviceId: observation.deviceId,
      });
    }
  }

  return {
    observedAt,
    nodes: Array.from(nodes.values()),
    edges,
    observations,
    uncertainty: UNCERTAINTY,
  };
}

function normalizeNodeId(value: string): string {
  return value.trim().replace(/^0x/i, "").toUpperCase().padStart(4, "0");
}

function upsertNode(
  nodes: Map<string, ObservedTopologyNode>,
  key: string,
  value: Omit<ObservedTopologyNode, "key" | "observedByDeviceIds"> & {
    observedByDeviceId: string;
  },
): void {
  const existing = nodes.get(key);
  nodes.set(key, {
    key,
    nodeIdHex: value.nodeIdHex ?? existing?.nodeIdHex,
    localDeviceId: value.localDeviceId ?? existing?.localDeviceId,
    observedByDeviceIds: Array.from(
      new Set([
        ...(existing?.observedByDeviceIds ?? []),
        value.observedByDeviceId,
      ]),
    ),
  });
}
