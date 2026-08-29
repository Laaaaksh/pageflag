export interface WidgetConfig {
  publicKey: string;
  apiBase: string;
  scriptSrc: string;
}

const SCRIPT_SUFFIX = "widget.js";

/** Reads `data-project` (and optional `data-api-base`) off the `<script>` tag that loaded us. */
export function readConfig(doc: Document = document): WidgetConfig | null {
  const script =
    (doc.currentScript as HTMLScriptElement | null) ??
    Array.from(doc.querySelectorAll("script")).find((s) => s.src.includes(SCRIPT_SUFFIX));
  if (!script) return null;

  const publicKey = script.dataset.project;
  if (!publicKey) return null;

  const apiBase = script.dataset.apiBase ?? new URL(script.src).origin;
  return { publicKey, apiBase, scriptSrc: script.src };
}

export function cls(name: string): string {
  return `pf-${name}`;
}

let stylesInjected = false;

export function injectStyles(doc: Document = document): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = doc.createElement("style");
  style.textContent = WIDGET_CSS;
  doc.head.appendChild(style);
}

/** Page-absolute coordinates (include scroll offset) for a viewport click point. */
export function toPageCoords(clientX: number, clientY: number): { pageX: number; pageY: number } {
  return { pageX: clientX + window.scrollX, pageY: clientY + window.scrollY };
}

export function toPercent(
  pageX: number,
  pageY: number,
  doc: Document = document,
): { x: number; y: number } {
  const width = doc.documentElement.scrollWidth || 1;
  const height = doc.documentElement.scrollHeight || 1;
  return { x: (pageX / width) * 100, y: (pageY / height) * 100 };
}

export function fromPercent(
  x: number,
  y: number,
  doc: Document = document,
): { pageX: number; pageY: number } {
  const width = doc.documentElement.scrollWidth;
  const height = doc.documentElement.scrollHeight;
  return { pageX: (x / 100) * width, pageY: (y / 100) * height };
}

/**
 * A short, reasonably-stable CSS selector for a clicked element: walks up to the
 * nearest ancestor with an id (or `body`), tagging each hop with an `nth-of-type`
 * index only when siblings of the same tag would otherwise make it ambiguous.
 */
export function cssSelector(el: Element, doc: Document = document): string {
  if (el.id) return `#${escapeIdent(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== doc.body && node.parentElement) {
    if (node.id) {
      parts.unshift(`#${escapeIdent(node.id)}`);
      break;
    }
    let selector = node.tagName.toLowerCase();
    const siblings = Array.from(node.parentElement.children).filter(
      (c) => c.tagName === node!.tagName,
    );
    if (siblings.length > 1) {
      selector += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    parts.unshift(selector);
    node = node.parentElement;
  }
  return parts.length > 0 ? parts.join(" > ") : "body";
}

/**
 * Uses the real `CSS.escape` where available; falls back to a conservative manual
 * escape (jsdom, and a handful of older embed contexts, don't implement it).
 */
function escapeIdent(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

export interface ReporterIdentity {
  name?: string;
  email?: string;
}

const IDENTITY_KEY = "pageflag:reporter";

export function loadReporterIdentity(): ReporterIdentity {
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as ReporterIdentity) : {};
  } catch {
    return {};
  }
}

export function saveReporterIdentity(identity: ReporterIdentity): void {
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // localStorage can throw in locked-down embed contexts (e.g. Safari private mode
    // quirks) - losing the "remember me" convenience is fine, submitting a pin is not.
  }
}

export const WIDGET_CSS = `
.pf-button {
  position: fixed; bottom: 20px; right: 20px; z-index: 2147483000;
  width: 52px; height: 52px; border-radius: 999px; border: none;
  background: #6d28d9; color: #fff; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,.25);
  display: flex; align-items: center; justify-content: center;
  font-family: system-ui, sans-serif;
}
.pf-button:hover { background: #5b21b6; }
.pf-button.pf-active { background: #dc2626; }
.pf-marker {
  position: absolute; z-index: 2147483000; width: 26px; height: 26px;
  margin-left: -13px; margin-top: -13px; border-radius: 999px 999px 999px 0;
  background: #6d28d9; color: #fff; font: 600 12px/26px system-ui, sans-serif;
  text-align: center; cursor: pointer; transform: rotate(45deg);
  box-shadow: 0 2px 6px rgba(0,0,0,.3);
}
.pf-marker.pf-resolved { background: #6b7280; }
.pf-marker > span { display: inline-block; transform: rotate(-45deg); }
.pf-popover {
  position: absolute; z-index: 2147483001; width: 280px; max-width: calc(100vw - 24px);
  background: #fff; color: #111827; border-radius: 10px; padding: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,.25); font: 13px/1.4 system-ui, sans-serif;
}
.pf-popover textarea {
  width: 100%; min-height: 64px; box-sizing: border-box; border: 1px solid #d1d5db;
  border-radius: 6px; padding: 6px 8px; font: inherit; resize: vertical;
}
.pf-popover input {
  width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px;
  padding: 6px 8px; font: inherit; margin-top: 6px;
}
.pf-popover .pf-row { display: flex; gap: 8px; margin-top: 8px; }
.pf-popover button.pf-submit {
  flex: 1; background: #6d28d9; color: #fff; border: none; border-radius: 6px;
  padding: 8px; font: inherit; font-weight: 600; cursor: pointer;
}
.pf-popover button.pf-cancel {
  background: #f3f4f6; color: #374151; border: none; border-radius: 6px;
  padding: 8px 12px; font: inherit; cursor: pointer;
}
.pf-popover .pf-status { margin-top: 6px; font-size: 12px; color: #6b7280; }
.pf-popover .pf-error { margin-top: 6px; font-size: 12px; color: #dc2626; }
`;
