import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { describe, expect, test } from "bun:test";
import { toText } from "@ui-sdk/react/token-input";

import { buildAttachmentUrl } from "../assets/urls";
import { buildUserMessageParts, convertToUIChatMessages, describeAttachments } from "./shared";

const photo = { name: "a.png", size: 2048, mimeType: "image/png", path: "u/t/a.png" };
const photoUrl = buildAttachmentUrl(photo.path, photo.mimeType);

describe("describeAttachments", () => {
  test("tells the model each file's name, type and size", () => {
    expect(describeAttachments([])).toBeNull();
    expect(describeAttachments([photo, { name: "b.pdf", size: 10, mimeType: "", path: "u/t/b.pdf" }])).toBe(
      "<attached_files>\n- a.png (image/png, 2 kB)\n- b.pdf (unknown type, 10 byte)\n</attached_files>",
    );
  });
});

describe("convertToUIChatMessages", () => {
  test("names a user message's files and lists them before the file parts", () => {
    const [message] = convertToUIChatMessages([
      {
        messageId: "m1",
        role: "user",
        metadata: undefined,
        parts: [
          { type: "text", text: "Look at [@a.png](file:x)" },
          { type: "file", url: photoUrl, mediaType: "image/png" },
        ],
        attachments: [photo],
      },
    ]);

    expect(message?.parts).toEqual([
      { type: "text", text: "Look at a.png" },
      { type: "text", text: "<attached_files>\n- a.png (image/png, 2 kB)\n</attached_files>" },
      { type: "file", url: photoUrl, mediaType: "image/png", filename: "a.png" },
    ]);
  });

  test("lists the files of a message that is only files", () => {
    const [message] = convertToUIChatMessages([
      {
        messageId: "m1",
        role: "user",
        metadata: undefined,
        parts: [
          { type: "text", text: "" },
          { type: "file", url: photoUrl, mediaType: "image/png", filename: "a.png" },
        ],
        attachments: [photo],
      },
    ]);

    expect(message?.parts.map((part) => part.type)).toEqual(["text", "file"]);
    expect(message?.parts[0]).toMatchObject({ text: expect.stringContaining("a.png") });
  });

  test("leaves file parts without a saved attachment, and assistant messages, as they are", () => {
    const part = { type: "file" as const, url: "https://elsewhere.test/x.png", mediaType: "image/png" };
    const [user, assistant] = convertToUIChatMessages([
      { messageId: "m1", role: "user", metadata: undefined, parts: [part], attachments: [] },
      { messageId: "m2", role: "assistant", metadata: undefined, parts: [part], attachments: [photo] },
    ]);

    expect(user?.parts).toEqual([part]);
    expect(assistant?.parts).toEqual([part]);
  });
});

function attachmentId(value: string): Id<"attachments"> {
  // SAFETY: The parts only carry the id along, so a plain string can stand in for a document id.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Id<"attachments">;
}

describe("buildUserMessageParts", () => {
  const uploadedPhoto = { ...photo, attachmentId: attachmentId("att1"), uploadId: "u1" };
  const photoPart = { type: "file" as const, url: photoUrl, mediaType: "image/png", filename: "a.png" };

  test("links the sent files' chips, names the rest and tells the model about each file", () => {
    const { displayParts, requestParts } = buildUserMessageParts(
      "See [@a.png](upload:u1), [@b.pdf](upload:u2) and [@c.pdf](file:old)",
      [uploadedPhoto],
    );

    expect(displayParts).toEqual([
      { type: "text", text: "See [@a.png](file:att1), b.pdf and c.pdf", state: "done" },
      photoPart,
    ]);
    expect(requestParts).toEqual([
      { type: "text", text: "See a.png, b.pdf and c.pdf" },
      { type: "text", text: "<attached_files>\n- a.png (image/png, 2 kB)\n</attached_files>" },
      photoPart,
    ]);
  });

  test("keeps a past file's chip when that file is sent", () => {
    const pastPhoto = { ...photo, attachmentId: attachmentId("old") };
    const { displayParts } = buildUserMessageParts("Again [@a.png](file:old)", [pastPhoto]);
    expect(displayParts[0]).toEqual({ type: "text", text: "Again [@a.png](file:old)", state: "done" });
  });

  test("saves only names while the files are still uploading", () => {
    const { displayParts } = buildUserMessageParts("See [@a.png](upload:u1)", []);
    expect(displayParts).toEqual([{ type: "text", text: "See a.png", state: "done" }]);
  });

  test("sends literal text that looks like a chip as typed", () => {
    const displayText = toText(["Explain [@home](file:example)"]);
    const { displayParts, requestParts } = buildUserMessageParts(displayText, []);

    expect(displayParts).toEqual([{ type: "text", text: displayText, state: "done" }]);
    expect(requestParts).toEqual([{ type: "text", text: "Explain [@home](file:example)" }]);
  });

  test("a message of only files has no text part", () => {
    const { displayParts, requestParts } = buildUserMessageParts("", [uploadedPhoto]);
    expect(displayParts).toEqual([photoPart]);
    expect(requestParts.map((part) => part.type)).toEqual(["text", "file"]);
  });
});
