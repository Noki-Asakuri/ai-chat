export const CHAT_APPEARANCE_COOKIE_NAME = "chat-appearance";
export const LEGACY_BACKGROUND_IMAGE_COOKIE_NAME = "background-image";
export const LEGACY_DISABLE_BLUR_COOKIE_NAME = "disable-blur";

type ChatAppearanceCookieValues = {
  chatAppearance: string | undefined;
  backgroundImage: string | undefined;
  disableBlur: string | undefined;
};

type PartialChatAppearance = {
  backgroundImage?: string;
  disableBlur?: boolean;
};

export type ChatAppearance = {
  backgroundImage: string | undefined;
  disableBlur: boolean;
};

export function readChatAppearanceFromCookieValues(
  values: ChatAppearanceCookieValues,
): ChatAppearance {
  const parsedAppearance = parseChatAppearanceCookie(values.chatAppearance);
  if (parsedAppearance) {
    return {
      backgroundImage: normalizeBackgroundImage(parsedAppearance.backgroundImage),
      disableBlur: parsedAppearance.disableBlur ?? false,
    };
  }

  return {
    backgroundImage: normalizeBackgroundImage(values.backgroundImage),
    disableBlur: values.disableBlur === "true",
  };
}

export function writeChatAppearanceCookie(appearance: ChatAppearance): void {
  if (!canUseDOM()) {
    return;
  }

  setCookie(CHAT_APPEARANCE_COOKIE_NAME, JSON.stringify(toCookiePayload(appearance)));
  deleteCookie(LEGACY_BACKGROUND_IMAGE_COOKIE_NAME);
  deleteCookie(LEGACY_DISABLE_BLUR_COOKIE_NAME);
}

function parseChatAppearanceCookie(rawValue: string | undefined): PartialChatAppearance | null {
  if (!rawValue) {
    return null;
  }

  const parsedRawValue = parseChatAppearancePayload(rawValue);
  if (parsedRawValue) {
    return parsedRawValue;
  }

  const decodedValue = decodeCookieValue(rawValue);
  if (!decodedValue || decodedValue === rawValue) {
    return null;
  }

  return parseChatAppearancePayload(decodedValue);
}

function parseChatAppearancePayload(rawValue: string): PartialChatAppearance | null {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!isRecord(parsedValue)) {
    return null;
  }

  const backgroundImage = parsedValue.backgroundImage;
  if (backgroundImage !== undefined && typeof backgroundImage !== "string") {
    return null;
  }

  const disableBlur = parsedValue.disableBlur;
  if (disableBlur !== undefined && typeof disableBlur !== "boolean") {
    return null;
  }

  const appearance: PartialChatAppearance = {};

  if (typeof backgroundImage === "string") {
    appearance.backgroundImage = backgroundImage;
  }

  if (typeof disableBlur === "boolean") {
    appearance.disableBlur = disableBlur;
  }

  return appearance;
}

function toCookiePayload(appearance: ChatAppearance): PartialChatAppearance {
  const payload: PartialChatAppearance = {
    disableBlur: appearance.disableBlur,
  };

  if (appearance.backgroundImage) {
    payload.backgroundImage = appearance.backgroundImage;
  }

  return payload;
}

function normalizeBackgroundImage(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value;
}

function decodeCookieValue(rawValue: string): string | null {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function canUseDOM(): boolean {
  return typeof document !== "undefined" && typeof document.cookie === "string";
}

function setCookie(name: string, value: string): void {
  const parts: string[] = [];
  parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  parts.push("Path=/");
  parts.push("SameSite=Lax");

  if (isLikelyHttps()) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

function deleteCookie(name: string): void {
  const parts: string[] = [];
  parts.push(`${encodeURIComponent(name)}=`);
  parts.push("Path=/");
  parts.push("SameSite=Lax");
  parts.push("Max-Age=0");

  if (isLikelyHttps()) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

function isLikelyHttps(): boolean {
  return typeof location !== "undefined" && location.protocol === "https:";
}
