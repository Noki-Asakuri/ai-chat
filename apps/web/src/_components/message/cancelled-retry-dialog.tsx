import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

type CancelledRetryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateVariant: () => void;
  onReplace: () => void;
};

export function CancelledRetryDialog({
  open,
  onOpenChange,
  onCreateVariant,
  onReplace,
}: CancelledRetryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retry cancelled response?</AlertDialogTitle>
          <AlertDialogDescription>
            This response already has content. Replace it, or keep it and create a new variant.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="secondary" onClick={onCreateVariant}>
            Create new variant
          </AlertDialogAction>
          <AlertDialogAction onClick={onReplace}>Replace response</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
