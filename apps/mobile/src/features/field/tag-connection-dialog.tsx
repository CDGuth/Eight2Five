import React from "react";
import { useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
} from "@eight2five/ui/components/modal";

import { TagConnectionContent } from "../settings/tag-connection-screen";

export function TagConnectionDialog({
  isOpen,
  onClose,
}: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  if (!isOpen) return null;
  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalBackdrop />
      <ModalContent style={{ maxHeight: Math.max(320, height * 0.86) }}>
        <ModalHeader className="items-center justify-between">
          <Heading size="md">Tag Connection</Heading>
          <ModalCloseButton accessibilityLabel="Close tag connection">
            <Icon as={X} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          <TagConnectionContent modal />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
