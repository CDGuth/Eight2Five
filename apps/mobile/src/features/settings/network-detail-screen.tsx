import React from "react";
import { Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Check,
  Pencil,
  Radio,
  ShieldCheck,
  Trash2,
  Triangle,
  TriangleAlert,
} from "lucide-react-native";
import {
  formatPanId,
  type ManagedDevice,
} from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import {
  networkDraftFromNetwork,
  validateNetworkDraft,
  type NetworkDraft,
} from "./network-form";
import { NetworkProfileForm } from "./network-profile-form";
import {
  anchorInitiatorLabel,
  commissioningWarningText,
  selectAssociatedCachedAnchors,
  selectNetworkAnchorDiscoveries,
  type NetworkAnchorDiscoveryRow,
} from "./network-ui";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
  SettingsValueRow,
} from "./settings-components";

export function NetworkDetailScreen({
  networkId,
}: {
  readonly networkId: string;
}) {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const { settings } = useAppSettingsSnapshot();
  const network = snapshot.networks.find((item) => item.id === networkId);
  const [draftOverride, setDraftOverride] = React.useState<NetworkDraft>();
  const draft = React.useMemo(
    () =>
      draftOverride ??
      (network ? networkDraftFromNetwork(network) : { name: "", panId: "" }),
    [draftOverride, network],
  );
  const connectionStateRef = React.useRef(snapshot.connectionState);
  React.useEffect(() => {
    connectionStateRef.current = snapshot.connectionState;
  }, [snapshot.connectionState]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  useFocusEffect(
    React.useCallback(() => {
      if (
        settings.developerModeEnabled &&
        snapshot.initialization === "ready" &&
        connectionStateRef.current !== "connected"
      ) {
        void store
          .startTagDiscovery()
          .catch((cause) => setError(toError(cause)));
      }
      return () => store.stopManualDiscovery();
    }, [settings.developerModeEnabled, snapshot.initialization, store]),
  );

  const validation = React.useMemo(
    () => validateNetworkDraft(draft, snapshot.networks, network?.id),
    [draft, network?.id, snapshot.networks],
  );
  const associatedAnchors = React.useMemo(
    () => selectAssociatedCachedAnchors(networkId, snapshot.knownAnchors),
    [networkId, snapshot.knownAnchors],
  );
  const discoveryRows = React.useMemo(
    () =>
      selectNetworkAnchorDiscoveries(
        snapshot.discoveries,
        snapshot.knownAnchors,
        snapshot.discoveryRssiCutoff,
      ),
    [snapshot.discoveries, snapshot.discoveryRssiCutoff, snapshot.knownAnchors],
  );

  if (snapshot.initialization === "loading") {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="info">
          Preparing network details…
        </SettingsMessage>
      </SettingsScreenContainer>
    );
  }

  if (!settings.developerModeEnabled) {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="info">
          Enable Developer Mode before managing PANS networks.
        </SettingsMessage>
      </SettingsScreenContainer>
    );
  }

  if (!network) {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="error">
          The selected network no longer exists.
        </SettingsMessage>
      </SettingsScreenContainer>
    );
  }

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setBusy(false);
    }
  };

  const ensureActiveNetwork = async () => {
    if (snapshot.activeNetworkId !== network.id) {
      await store.setActiveNetwork(network.id);
    }
  };

  const save = () => {
    if (!validation.value) return;
    void run(async () => {
      const saved = await store.updateNetwork(network.id, {
        name: validation.value!.name,
        panId: validation.value!.panId,
      });
      setDraftOverride(networkDraftFromNetwork(saved));
    });
  };

  const setActive = () =>
    void run(async () => {
      await store.setActiveNetwork(network.id);
    });

  const openAnchor = (anchorId: string) => {
    router.push({
      pathname: "/(tabs)/settings/anchor/[anchorId]",
      params: { anchorId },
    });
  };

  const persistDiscovery = async (
    row: NetworkAnchorDiscoveryRow,
    confirmRoleChange: boolean,
  ) => {
    await run(async () => {
      await ensureActiveNetwork();
      if (row.cachedAnchor && row.advertisedRole === "anchor") {
        await store.assignDeviceToActiveNetwork(row.cachedAnchor.id);
        openAnchor(row.cachedAnchor.id);
        return;
      }
      const saved = await store.persistDiscoveredAnchor(
        row.discovery.transportDeviceId,
        confirmRoleChange,
      );
      if (saved.networkId !== network.id) {
        await store.assignDeviceToActiveNetwork(saved.id);
      }
      openAnchor(saved.id);
    });
  };

  const handleDiscovery = (row: NetworkAnchorDiscoveryRow) => {
    if (
      row.cachedAnchor?.networkId === network.id &&
      row.advertisedRole === "anchor"
    ) {
      openAnchor(row.cachedAnchor.id);
      return;
    }
    if (row.requiresRoleChangeConfirmation) {
      Alert.alert(
        "Convert device to anchor?",
        `${
          row.discovery.name ?? row.discovery.transportDeviceId
        } is advertising as ${
          row.advertisedRole === "unknown" ? "an unknown role" : "a tag"
        }. Converting it changes the PANS hardware role and may interrupt its current use.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Convert to Anchor",
            style: "destructive",
            onPress: () => void persistDiscovery(row, true),
          },
        ],
      );
      return;
    }
    void persistDiscovery(row, false);
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete network profile?",
      `Delete ${network.name}? Its cached device associations will be removed, but this does not erase hardware.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Network",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              await store.deleteNetwork(network.id);
              router.back();
            }),
        },
      ],
    );
  };

  return (
    <SettingsScreenContainer>
      {error || snapshot.error ? (
        <SettingsMessage tone="error">
          {(error ?? snapshot.error)?.message}
        </SettingsMessage>
      ) : null}
      {commissioningWarningText(snapshot.commissioningWarning) ? (
        <SettingsMessage tone="warning">
          {commissioningWarningText(snapshot.commissioningWarning)}
        </SettingsMessage>
      ) : null}

      <SettingsSection title="Network profile">
        <SettingsValueRow
          icon={Radio}
          title={network.name}
          description="App-local profile; hardware changes happen only during explicit commissioning."
          value={formatPanId(network.panId)}
        />
        <VStack style={{ padding: eight2FiveSpacing.md }}>
          <Button
            variant={
              snapshot.activeNetworkId === network.id ? "default" : "outline"
            }
            testID="set-active-network-button"
            isDisabled={busy || snapshot.activeNetworkId === network.id}
            onPress={setActive}
          >
            {snapshot.activeNetworkId === network.id ? (
              <ButtonIcon as={Check} />
            ) : (
              <ButtonIcon as={ShieldCheck} />
            )}
            <ButtonText>
              {snapshot.activeNetworkId === network.id
                ? "Active Network"
                : "Set Active Network"}
            </ButtonText>
          </Button>
        </VStack>
      </SettingsSection>

      <SettingsSection title="Edit network profile">
        <VStack style={{ padding: eight2FiveSpacing.md }}>
          <NetworkProfileForm
            draft={draft}
            errors={validation.errors}
            saving={busy}
            submitLabel="Save Network"
            onChange={setDraftOverride}
            onSubmit={save}
          />
        </VStack>
      </SettingsSection>

      <SettingsSection title="Associated cached anchors">
        {associatedAnchors.length === 0 ? (
          <HStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
            <Icon as={Triangle} style={{ color: theme.textMuted }} />
            <Text style={{ color: theme.textMuted }}>
              No cached anchors are associated with this network yet. Start with
              the live discovery list below.
            </Text>
          </HStack>
        ) : (
          associatedAnchors.map((anchor) => (
            <CachedAnchorRow
              key={anchor.id}
              anchor={anchor}
              busy={busy}
              onEdit={() => openAnchor(anchor.id)}
              onSetInitiator={() =>
                void run(async () => {
                  await ensureActiveNetwork();
                  await store.setAnchorInitiator(anchor.id);
                })
              }
            />
          ))
        )}
      </SettingsSection>

      <SettingsSection title="Discover anchors nearby">
        {snapshot.connectionState === "connected" ? (
          <SettingsMessage tone="warning">
            Disconnect the current performer tag before starting anchor
            discovery.
          </SettingsMessage>
        ) : null}
        {discoveryRows.length === 0 ? (
          <Text
            style={{ color: theme.textMuted, padding: eight2FiveSpacing.md }}
          >
            {snapshot.connectionState === "scanning"
              ? "Looking for compatible PANS devices…"
              : "No current compatible devices meet the signal requirement."}
          </Text>
        ) : (
          discoveryRows.map((row) => (
            <DiscoveryAnchorRow
              key={row.discovery.transportDeviceId}
              row={row}
              busy={busy}
              onPress={() => handleDiscovery(row)}
            />
          ))
        )}
      </SettingsSection>

      <Button
        variant="destructive"
        testID="delete-network-button"
        isDisabled={busy}
        onPress={confirmDelete}
      >
        {busy ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
        <ButtonText>Delete Network</ButtonText>
      </Button>

      {snapshot.commissioningWarning ? (
        <HStack style={{ gap: 10 }}>
          <Icon as={TriangleAlert} style={{ color: theme.warning }} />
          <Text selectable style={{ color: theme.warning }}>
            Hardware verification is incomplete. Keep the warning above until
            the unreachable anchors can be checked.
          </Text>
        </HStack>
      ) : null}
    </SettingsScreenContainer>
  );
}

function CachedAnchorRow({
  anchor,
  busy,
  onEdit,
  onSetInitiator,
}: {
  readonly anchor: ManagedDevice;
  readonly busy: boolean;
  readonly onEdit: () => void;
  readonly onSetInitiator: () => void;
}) {
  const theme = useEight2FiveTheme();
  const initiator = anchorInitiatorLabel(anchor);
  return (
    <HStack
      className="items-center"
      style={{ gap: 12, padding: eight2FiveSpacing.md }}
    >
      <Pressable
        className="flex-1"
        testID={`edit-network-anchor-${anchor.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Edit anchor ${anchor.nodeIdHex ?? anchor.label ?? anchor.id}`}
        disabled={busy}
        onPress={onEdit}
      >
        <HStack className="items-center" style={{ gap: 12 }}>
          <Icon as={Radio} style={{ color: theme.accent }} />
          <VStack className="flex-1" style={{ gap: 2 }}>
            <Text selectable style={{ color: theme.text }}>
              {anchor.nodeIdHex ?? anchor.label ?? anchor.id}
            </Text>
            <Text size="sm" style={{ color: theme.textMuted }}>
              Initiator: {initiator}
            </Text>
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              {anchor.transportDeviceId}
            </Text>
          </VStack>
          <Icon as={Pencil} style={{ color: theme.accent }} />
        </HStack>
      </Pressable>
      {initiator === "Yes" ? (
        <Icon as={ShieldCheck} style={{ color: theme.success }} />
      ) : (
        <Button
          variant="outline"
          size="sm"
          testID={`set-initiator-${anchor.id}`}
          isDisabled={busy}
          onPress={onSetInitiator}
        >
          <ButtonText>Set initiator</ButtonText>
        </Button>
      )}
    </HStack>
  );
}

function DiscoveryAnchorRow({
  row,
  busy,
  onPress,
}: {
  readonly row: NetworkAnchorDiscoveryRow;
  readonly busy: boolean;
  readonly onPress: () => void;
}) {
  const theme = useEight2FiveTheme();
  const cached = row.cachedAnchor;
  const title =
    cached?.nodeIdHex ??
    cached?.label ??
    row.discovery.name ??
    row.discovery.transportDeviceId;
  const action = cached ? "Assign to this network" : "Add as anchor";
  return (
    <Pressable
      testID={`discover-anchor-${row.discovery.transportDeviceId}`}
      accessibilityRole="button"
      accessibilityLabel={`${action}: ${title}`}
      disabled={busy}
      onPress={onPress}
    >
      <HStack
        className="items-center"
        style={{ gap: 12, padding: eight2FiveSpacing.md }}
      >
        <Icon
          as={row.advertisedRole === "anchor" ? Radio : TriangleAlert}
          style={{ color: theme.accent }}
        />
        <VStack className="flex-1" style={{ gap: 2 }}>
          <Text selectable style={{ color: theme.text }}>
            {title}
          </Text>
          <Text size="sm" style={{ color: theme.textMuted }}>
            {row.advertisedRole === "unknown"
              ? "Unknown role"
              : `Advertised ${row.advertisedRole}`}{" "}
            · {row.discovery.rssi} dBm
          </Text>
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {cached
              ? `Cached · Initiator: ${anchorInitiatorLabel(cached)}`
              : "Not cached"}
          </Text>
        </VStack>
        <Button
          variant="outline"
          size="sm"
          testID={`commission-anchor-${row.discovery.transportDeviceId}`}
          isDisabled={busy}
          onPress={onPress}
        >
          <ButtonText>
            {row.requiresRoleChangeConfirmation ? "Convert" : action}
          </ButtonText>
        </Button>
      </HStack>
    </Pressable>
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
