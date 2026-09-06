import { useId } from "react";
import { v4 as uuidv4 } from "uuid";

import { tryGetModelData } from "@/lib/chat/models";
import type { UserAttachment } from "@/lib/types";

export function useChatAttachmentInput({
  model,
  handleAddAttachments,
}: {
  model: string;
  handleAddAttachments: (files: UserAttachment[]) => void;
}) {
  const inputId = useId();
  const acceptedAttachmentTypes = tryGetModelData(model)?.modalities.input.filter(
    (modality) => modality === "image" || modality === "pdf",
  );

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    let type: "image" | "pdf" = "image";
    if (file.type.includes("pdf")) type = "pdf";

    handleAddAttachments([{ id: uuidv4(), type, file }]);

    // allow re-uploading the same file
    event.target.value = "";
  }

  return {
    accept: acceptedAttachmentTypes
      ?.map((modality) => (modality === "image" ? "image/*" : "application/pdf"))
      .join(","),
    handleChange,
    inputId,
    supportsAttachments: !!acceptedAttachmentTypes?.length,
  };
}
