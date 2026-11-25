import { describe, expect, test } from "bun:test";

import { buildAttachmentUrl } from "../assets/urls";
import { convertToUIChatMessages, describeAttachments } from "./shared";

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
