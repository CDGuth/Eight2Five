import React from "react";
import { useLocalSearchParams } from "expo-router";
import type { ObservedPansTopology } from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/vstack";

import {
  KeyValue,
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
} from "../components/manager-ui";
import { useManagedNetwork, usePansLiveNetwork } from "../manager-context";
import { displayError } from "../manager-utils";

export function NetworkTopologyScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const theme = useEight2FiveTheme();
  const { network, devices } = useManagedNetwork(networkId);
  const { refreshTopology } = usePansLiveNetwork();
  const [topology, setTopology] = React.useState<ObservedPansTopology>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();

  if (!network)
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setTopology(await refreshTopology(network.id));
    } catch (nextError) {
      setError(displayError(nextError));
    } finally {
      setLoading(false);
    }
  };
  const anchors = devices.filter((device) => device.role === "anchor");
  const initiators = anchors.filter(
    (device) =>
      device.lastKnownConfig?.role === "anchor" &&
      device.lastKnownConfig.initiatorEnabled,
  );
  const neighborMapEvidence =
    topology?.observations.filter((observation) =>
      Boolean(observation.clusterInfo?.clusterNeighborMap),
    ) ?? [];

  return (
    <ManagerScreen>
      <SectionCard
        title="Observed topology"
        description="Refresh to read anchor and cluster relationships."
      >
        <KeyValue
          label="Local anchor membership"
          value={`${anchors.length} saved anchor(s)`}
        />
        <KeyValue
          label="Configured initiators"
          value={
            initiators.length
              ? initiators
                  .map((device) => device.nickname || device.label || device.id)
                  .join(", ")
              : "None in verified local configs"
          }
        />
        <KeyValue
          label="Observed cluster-neighbor map presence"
          value={
            topology
              ? `${neighborMapEvidence.length} anchor(s) returned a non-zero cluster-neighbor map`
              : "Refresh required"
          }
        />
        <ManagerButton
          label="Refresh observed topology"
          loading={loading}
          onPress={() => void refresh()}
        />
        {error ? (
          <StatePanel
            state="error"
            message={error}
            onRetry={() => void refresh()}
          />
        ) : null}
      </SectionCard>

      {topology ? (
        <>
          <StatePanel state="info" message={topology.uncertainty} />
          <SectionCard title={`Observed edges (${topology.edges.length})`}>
            {topology.edges.length ? (
              <VStack space="sm">
                {topology.edges.map((edge, index) => (
                  <Text
                    key={`${edge.sourceKey}-${edge.targetKey}-${index}`}
                    selectable
                    size="sm"
                    style={{ color: theme.text }}
                  >
                    {edge.sourceKey} → {edge.targetKey} (reported by{" "}
                    {edge.observedByDeviceId})
                  </Text>
                ))}
              </VStack>
            ) : (
              <Text selectable size="sm" style={{ color: theme.textMuted }}>
                No neighbor edges were reported.
              </Text>
            )}
          </SectionCard>
          <SectionCard title="Anchor observations">
            <VStack style={{ gap: eight2FiveSpacing.md }}>
              {topology.observations.map((observation) => (
                <VStack
                  key={observation.deviceId}
                  style={{
                    gap: 4,
                    borderRadius: eight2FiveRadii.sm,
                    backgroundColor: theme.surface,
                    padding: 12,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: theme.text,
                      fontFamily: eight2FiveFonts.styleSemibold,
                    }}
                  >
                    {devices.find(
                      (device) => device.id === observation.deviceId,
                    )?.nickname || observation.deviceId}
                  </Text>
                  <Text selectable size="sm" style={{ color: theme.textMuted }}>
                    Local node: {observation.localNodeIdHex ?? "unknown"};
                    anchors reported:{" "}
                    {observation.anchorList?.anchors.length ?? "unavailable"}
                  </Text>
                  <Text selectable size="sm" style={{ color: theme.textMuted }}>
                    Cluster seat:{" "}
                    {observation.clusterInfo?.seatNumber ?? "unavailable"}; map:{" "}
                    {observation.clusterInfo?.clusterMap ?? "unavailable"};
                    neighbor map:{" "}
                    {observation.clusterInfo?.clusterNeighborMap ??
                      "unavailable"}
                  </Text>
                  {observation.errors.map((message) => (
                    <StatePanel key={message} state="error" message={message} />
                  ))}
                </VStack>
              ))}
            </VStack>
          </SectionCard>
        </>
      ) : null}
    </ManagerScreen>
  );
}
