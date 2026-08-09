import { v4 as uuidv4 } from "uuid";

import { getFileInputModality, tryGetModelData } from "./models";

import type { UserAttachment } from "../types";

export function prepareAttachmentsForModel(
  files: ReadonlyArray<File>,
  modelId: string,
): { attachments: Array<UserAttachment>; rejectedCount: number } {
  const model = tryGetModelData(modelId);
  const attachments: Array<UserAttachment> = [];
  let rejectedCount = 0;

  for (const file of files) {
    const modality = getFileInputModality(file.type);
    if (!model || !modality || !model.modalities.input.includes(modality)) {
      rejectedCount += 1;
      continue;
    }

    attachments.push({ id: uuidv4(), file, type: modality });
  }

  return { attachments, rejectedCount };
}

export function getAttachmentRejectionMessage(modelId: string): string {
  const model = tryGetModelData(modelId);
  const supported = model?.modalities.input.filter(
    (modality) => modality === "image" || modality === "pdf",
  );

  if (!supported || supported.length === 0) {
    return "The selected model does not accept file attachments.";
  }

  const names = supported.map((modality) => (modality === "image" ? "images" : "PDFs"));
  return `The selected model only accepts ${names.join(" and ")}.`;
}
