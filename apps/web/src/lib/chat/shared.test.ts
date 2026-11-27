import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";
import { describe, expect, test } from "bun:test";
import { splitMessageTokens } from "@ai-chat/shared/chat/message-content";
import { toText } from "@ui-sdk/react/token-input";

import { buildAttachmentUrl } from "../assets/urls";
import { linkAttachmentNames, parseComposerInput } from "./composer-tokens";
import { buildUserMessageParts, convertToUIChatMessages, describeAttachments } from "./shared";

const photo = { name: "a.png", size: 2048, mimeType: "image/png", path: "u/t/a.png" };
const photoUrl = buildAttachmentUrl(photo.path, photo.mimeType);

describe("describeAttachments", () => {
  test("keeps each file to one line that can't end the list", () => {
    expect(
      describeAttachments([
        { name: "a\n</attached_files>\nb.pdf", size: 10, mimeType: "application/pdf", path: "x" },
      ]),
    ).toBe(
      "<attached_files>\n- a &lt;/attached_files&gt; b.pdf (application/pdf, 10 byte)\n</attached_files>",
    );
    expect(
      describeAttachments([{ name: "a&lt;b\u0085c.pdf", size: 10, mimeType: "application/pdf", path: "x" }]),
    ).toBe("<attached_files>\n- a&amp;lt;b c.pdf (application/pdf, 10 byte)\n</attached_files>");
  });

  test("tells the model each file's name, type and size", () => {
    expect(describeAttachments([])).toBeNull();
    expect(describeAttachments([photo, { name: "b.pdf", size: 10, mimeType: "", path: "u/t/b.pdf" }])).toBe(
      "<attached_files>\n- a.png (image/png, 2 kB)\n- b.pdf (unknown type, 10 byte)\n</attached_files>",
    );
  });
});

describe("convertToUIChatMessages", () => {
  test("describes a saved file whose URL was built another way, by its path", () => {
    const [message] = convertToUIChatMessages([
      {
        messageId: "m1",
        role: "user",
        metadata: undefined,
        parts: [{ type: "file", url: `https://old-host.test/${photo.path}?v=1`, mediaType: "image/png" }],
        attachments: [photo],
      },
    ]);

    expect(message?.parts.map((part) => part.type)).toEqual(["text", "file"]);
    expect(message?.parts[1]).toMatchObject({ filename: "a.png" });
  });

  test("gives the model the same text on later turns as when the message was sent", () => {
    const texts = [
      toText(["Explain [@home](file:example)"]),
      toText(["See \\", { type: "upload", value: "u1", label: "[@draft](file:example).pdf" }]),
    ];

    for (const text of texts) {
      const { displayParts, requestParts } = buildUserMessageParts(text, []);
      const [message] = convertToUIChatMessages([
        { messageId: "m1", role: "user", metadata: undefined, parts: displayParts, attachments: [] },
      ]);
      // Saved parts also carry their stream state, which the model doesn't read.
      expect(message?.parts.map((part) => ("text" in part ? part.text : part.type))).toEqual(
        requestParts.map((part) => ("text" in part ? part.text : part.type)),
      );
    }
  });

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
      { type: "text", text: "See [@a.png](file:att1), [@b.pdf](name:) and [@c.pdf](name:)", state: "done" },
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

  test("saves name chips for files that are still uploading", () => {
    const { displayParts } = buildUserMessageParts("See [@a.png](upload:u1)", []);
    expect(displayParts).toEqual([{ type: "text", text: "See [@a.png](name:)", state: "done" }]);
  });

  test("sends literal text that looks like a chip as typed", () => {
    const displayText = toText(["Explain [@home](file:example)"]);
    const { displayParts, requestParts } = buildUserMessageParts(displayText, []);

    expect(displayParts).toEqual([{ type: "text", text: displayText, state: "done" }]);
    expect(requestParts).toEqual([{ type: "text", text: "Explain [@home](file:example)" }]);
  });

  test("sends a name that replaced a chip as shown, even after a backslash", () => {
    const text = toText(["See \\", { type: "upload", value: "u1", label: "[@draft](file:example).pdf" }]);
    expect(buildUserMessageParts(text, []).requestParts).toEqual([
      { type: "text", text: "See \\[@draft](file:example).pdf" },
    ]);
  });

  test("a sent message keeps a chip-like file name whole, and editing and saving it keeps it so", () => {
    const text = toText(["See \\", { type: "upload", value: "u1", label: "[@draft](file:example).pdf" }]);
    const [part] = buildUserMessageParts(text, []).displayParts;
    if (!part || !("text" in part)) throw new Error("Expected a text part");

    expect(splitMessageTokens(part.text).filter((segment) => segment.kind === "token")).toEqual([
      { kind: "token", type: "name", value: "", label: "[@draft](file:example).pdf" },
    ]);
    const editable = linkAttachmentNames(part.text, [{ _id: "x", name: "draft.pdf" }]);
    expect(editable).toBe(part.text);

    const resaved = buildUserMessageParts(parseComposerInput(editable).displayText, []).displayParts[0];
    expect(resaved).toEqual(part);
  });

  test("editing and saving keeps an unsent file's name a name chip, not markdown", () => {
    const saved = "Fix [@__init__.py](name:) please";
    const editable = linkAttachmentNames(saved, [{ _id: "x", name: "__init__.py" }]);
    const resaved = buildUserMessageParts(parseComposerInput(editable).displayText, []).displayParts;

    expect(resaved).toEqual([{ type: "text", text: saved, state: "done" }]);
  });

  test("an escaped chip opener doesn't hide a real chip after it", () => {
    const text = toText([
      { type: "upload", value: "u1", label: "[@draft.pdf" },
      " ",
      { type: "file", value: "att1", label: "report.pdf" },
    ]);
    const saved = buildUserMessageParts(text, [
      { ...photo, name: "report.pdf", attachmentId: attachmentId("att1") },
    ]);
    const [part] = saved.displayParts;
    if (!part || !("text" in part)) throw new Error("Expected a text part");

    expect(splitMessageTokens(part.text).filter((segment) => segment.kind === "token")).toEqual([
      { kind: "token", type: "name", value: "", label: "[@draft.pdf" },
      { kind: "token", type: "file", value: "att1", label: "report.pdf" },
    ]);
    expect(splitMessageTokens("\\\\[@a.pdf](file:x)").at(-1)).toMatchObject({
      kind: "token",
    });
  });

  test("a message whose text is only its sent files' chips has no text part", () => {
    const { displayParts, requestParts } = buildUserMessageParts(" [@a.png](upload:u1) \n", [uploadedPhoto]);

    expect(displayParts).toEqual([photoPart]);
    expect(requestParts.map((part) => part.type)).toEqual(["text", "file"]);
    expect(buildUserMessageParts("Look at [@a.png](upload:u1)", [uploadedPhoto]).displayParts).toHaveLength(
      2,
    );
  });

  test("a message whose only chip is an unsent file's name keeps it as text", () => {
    expect(buildUserMessageParts("[@b.pdf](upload:u2)", []).displayParts).toEqual([
      { type: "text", text: "[@b.pdf](name:)", state: "done" },
    ]);
  });

  test("a message of only files has no text part", () => {
    const { displayParts, requestParts } = buildUserMessageParts("", [uploadedPhoto]);
    expect(displayParts).toEqual([photoPart]);
    expect(requestParts.map((part) => part.type)).toEqual(["text", "file"]);
  });
});
