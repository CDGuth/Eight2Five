import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@eight2five/ui/components/modal";
import { Heading } from "@eight2five/ui/components/heading";

import { DrillNameForm } from "./drill-name-form";

export function DrillNameDialog({
  isOpen,
  initialValue,
  saving,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  initialValue: string;
  saving: boolean;
  onClose(): void;
  onSave(name: string): Promise<void>;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" avoidKeyboard>
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">Rename Drill</Heading>
        </ModalHeader>
        <ModalBody>
          <DrillNameForm
            key={initialValue}
            initialValue={initialValue}
            submitLabel="Rename"
            saving={saving}
            onSubmit={onSave}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
