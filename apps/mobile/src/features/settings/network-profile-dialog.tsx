import React from "react";
import { Alert } from "react-native";
import { Trash2, X } from "lucide-react-native";
import type { ManagedNetwork } from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@eight2five/ui/components/modal";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing } from "@eight2five/ui/theme";

import { SpinningLoaderIcon } from "../../components/spinning-loader-icon";
import {
  networkDraftFromNetwork,
  validateNetworkDraft,
  type NetworkDraft,
} from "./network-form";
import { NetworkProfileForm } from "./network-profile-form";
import { SettingsMessage } from "./settings-components";

export function NetworkProfileDialog({
  network,
  networks,
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  readonly network?: ManagedNetwork;
  readonly networks: readonly ManagedNetwork[];
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreate: (name: string, panId: number) => Promise<void>;
  readonly onUpdate: (
    networkId: string,
    changes: { readonly name: string; readonly panId: number },
  ) => Promise<void>;
  readonly onDelete: (networkId: string) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<NetworkDraft>(() =>
    network ? networkDraftFromNetwork(network) : { name: "", panId: "" },
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  const validation = React.useMemo(
    () => validateNetworkDraft(draft, networks, network?.id),
    [draft, network?.id, networks],
  );

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!validation.value) return;
    void run(async () => {
      if (network) {
        await onUpdate(network.id, validation.value!);
      } else {
        await onCreate(validation.value!.name, validation.value!.panId);
      }
      onClose();
    });
  };

  const confirmDelete = () => {
    if (!network) return;
    Alert.alert(
      "Delete network profile?",
      `Delete ${network.name}? Cached device records remain, but their association with this profile is removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Network",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              await onDelete(network.id);
              onClose();
            }),
        },
      ],
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? undefined : onClose} size="lg">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader className="items-center justify-between">
          <Heading size="md">
            {network ? "Edit Network" : "New Network"}
          </Heading>
          <ModalCloseButton
            accessibilityLabel="Close network editor"
            disabled={busy}
          >
            <Icon as={X} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          <VStack style={{ gap: eight2FiveSpacing.md }}>
            {error ? (
              <SettingsMessage tone="error">{error.message}</SettingsMessage>
            ) : null}
            <NetworkProfileForm
              draft={draft}
              errors={validation.errors}
              saving={busy}
              submitLabel={network ? "Save Network" : "Create Network"}
              onChange={setDraft}
              onSubmit={save}
            />
          </VStack>
        </ModalBody>
        {network ? (
          <ModalFooter>
            <Button
              variant="destructive"
              testID="delete-network-button"
              isDisabled={busy}
              onPress={confirmDelete}
            >
              {busy ? <SpinningLoaderIcon /> : <ButtonIcon as={Trash2} />}
              <ButtonText>Delete Network</ButtonText>
            </Button>
          </ModalFooter>
        ) : null}
      </ModalContent>
    </Modal>
  );
}
