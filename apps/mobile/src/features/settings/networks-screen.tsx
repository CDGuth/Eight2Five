import React from "react";
import { useRouter } from "expo-router";
import {
  Check,
  ChevronRight,
  Network,
  Plus,
  TriangleAlert,
} from "lucide-react-native";
import {
  formatPanId,
  type ManagedNetwork,
} from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import { NetworkProfileForm } from "./network-profile-form";
import { validateNetworkDraft, type NetworkDraft } from "./network-form";
import { commissioningWarningText } from "./network-ui";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
  SettingsValueRow,
} from "./settings-components";

const EMPTY_DRAFT: NetworkDraft = { name: "", panId: "" };

export function NetworksScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const { settings } = useAppSettingsSnapshot();
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<NetworkDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error>();
  const validation = React.useMemo(
    () => validateNetworkDraft(draft, snapshot.networks),
    [draft, snapshot.networks],
  );
  const activeNetwork = snapshot.networks.find(
    (network) => network.id === snapshot.activeNetworkId,
  );

  if (!snapshot.initialization || snapshot.initialization === "loading") {
    return (
      <SettingsScreenContainer>
        <SettingsMessage tone="info">Preparing PANS networks…</SettingsMessage>
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

  const save = () => {
    if (!validation.value) return;
    void run(async () => {
      const network = await store.createNetwork(
        validation.value!.name,
        validation.value!.panId,
      );
      setDraft(EMPTY_DRAFT);
      setCreating(false);
      openNetwork(router, network);
    });
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

      <SettingsSection title="Active network">
        <SettingsValueRow
          icon={Network}
          title={activeNetwork?.name ?? "No active network"}
          description={
            activeNetwork
              ? "New anchor commissioning uses this profile."
              : "Choose a profile before assigning anchors."
          }
          value={activeNetwork ? formatPanId(activeNetwork.panId) : "None"}
        />
      </SettingsSection>

      <SettingsSection title="Saved networks">
        <VStack style={{ gap: eight2FiveSpacing.sm }}>
          <Button
            variant="outline"
            testID="create-network-button"
            isDisabled={busy || snapshot.initialization !== "ready"}
            onPress={() => {
              setError(undefined);
              setCreating((value) => !value);
            }}
          >
            <ButtonIcon as={Plus} />
            <ButtonText>{creating ? "Cancel" : "Create Network"}</ButtonText>
          </Button>

          {creating ? (
            <VStack style={{ padding: eight2FiveSpacing.md }}>
              <NetworkProfileForm
                draft={draft}
                errors={validation.errors}
                saving={busy}
                submitLabel="Create Network"
                onChange={setDraft}
                onSubmit={save}
              />
            </VStack>
          ) : null}

          {snapshot.networks.length === 0 ? (
            <HStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
              <Icon as={TriangleAlert} style={{ color: theme.textMuted }} />
              <Text style={{ color: theme.textMuted }}>
                No network profiles are saved on this device.
              </Text>
            </HStack>
          ) : (
            snapshot.networks.map((network) => (
              <NetworkRow
                key={network.id}
                network={network}
                active={network.id === snapshot.activeNetworkId}
                disabled={busy}
                onOpen={() => openNetwork(router, network)}
                onSetActive={() =>
                  void run(async () => {
                    await store.setActiveNetwork(network.id);
                  })
                }
              />
            ))
          )}
        </VStack>
      </SettingsSection>
    </SettingsScreenContainer>
  );
}

function NetworkRow({
  network,
  active,
  disabled,
  onOpen,
  onSetActive,
}: {
  readonly network: ManagedNetwork;
  readonly active: boolean;
  readonly disabled: boolean;
  readonly onOpen: () => void;
  readonly onSetActive: () => void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
      <Pressable
        testID={`open-network-${network.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Open network ${network.name}`}
        disabled={disabled}
        onPress={onOpen}
      >
        <HStack
          className="items-center"
          style={{ gap: 12, padding: eight2FiveSpacing.md }}
        >
          <Icon
            as={Network}
            style={{ color: active ? theme.accent : theme.icon }}
          />
          <VStack className="flex-1" style={{ gap: 2 }}>
            <Text selectable style={{ color: theme.text }}>
              {network.name}
            </Text>
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              PAN {formatPanId(network.panId)}
            </Text>
          </VStack>
          {active ? (
            <HStack className="items-center" style={{ gap: 4 }}>
              <Icon as={Check} size="sm" style={{ color: theme.success }} />
              <Text size="sm" style={{ color: theme.success }}>
                Active
              </Text>
            </HStack>
          ) : null}
          <Icon as={ChevronRight} style={{ color: theme.textMuted }} />
        </HStack>
      </Pressable>
      {!active ? (
        <Button
          variant="ghost"
          size="sm"
          testID={`set-active-network-${network.id}`}
          isDisabled={disabled}
          onPress={onSetActive}
        >
          <ButtonText>Set Active Network</ButtonText>
        </Button>
      ) : null}
    </VStack>
  );
}

function openNetwork(
  router: ReturnType<typeof useRouter>,
  network: ManagedNetwork,
) {
  router.push({
    pathname: "/(tabs)/settings/network/[networkId]" as never,
    params: { networkId: network.id },
  });
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
