import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { afterAll, afterEach } from "bun:test";

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register({ url: "http://localhost:3000/" });

// happy-dom leaves compatMode undefined, which libraries like KaTeX read as quirks mode.
Object.defineProperty(document, "compatMode", { configurable: true, value: "CSS1Compat" });

globalThis.__UI_SDK_STRICT__ = true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The DOM shim lacks the popover, animation and layout APIs ui-sdk's popups rely on.
HTMLElement.prototype.showPopover = function () {};
HTMLElement.prototype.hidePopover = function () {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.checkVisibility = () => true;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  }),
);

const { cleanup } = await import("@testing-library/react");
afterEach(cleanup);
afterAll(() => GlobalRegistrator.unregister());
