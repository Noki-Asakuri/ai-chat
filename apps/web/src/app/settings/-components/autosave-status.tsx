import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type AutosaveStatusProps = {
  isSaving: boolean;
};

export function AutosaveStatus(props: AutosaveStatusProps) {
  return (
    <Badge variant="secondary" aria-live="polite">
      {props.isSaving ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
      {props.isSaving ? "Saving" : "Saved"}
    </Badge>
  );
}
