import { Modal } from '@components/Modal';
import { Button } from '@components/Button';
import { Text } from '@components/PixelFont';
import { exitExpandedMode } from '@devvit/web/client';

export type DeleteConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function DeleteConfirmationModal(props: DeleteConfirmationModalProps) {
  const { isOpen, onClose } = props;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete drawing?">
      {/* Body Copy - Concise and to the point. */}
      <div className="flex flex-col gap-1 items-center justify-center w-full">
        <Text>You cannot undo</Text>
        <Text>this action later</Text>
      </div>

      {/* Actions - The primary action has been placed on the left side and deemphasized to avoid accidental misclicks given the severity of the action.
       */}
      <div className="flex flex-row gap-3 items-center justify-center w-full">
        <Button
          variant="white"
          onClick={async (e) => {
            void exitExpandedMode(e);
          }}
        >
          Delete
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
