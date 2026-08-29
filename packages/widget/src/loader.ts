import { cls, fromPercent, injectStyles, readConfig, type WidgetConfig } from "./shared.js";

interface RemotePin {
  id: string;
  x: number;
  y: number;
  comment: string;
  status: "open" | "in_progress" | "resolved";
}

function currentPageUrl(): string {
  return location.origin + location.pathname;
}

function renderMarker(config: WidgetConfig, pin: RemotePin): void {
  const { pageX, pageY } = fromPercent(Number(pin.x), Number(pin.y));
  const marker = document.createElement("div");
  marker.className = cls("marker") + (pin.status === "resolved" ? ` ${cls("resolved")}` : "");
  marker.style.left = `${pageX}px`;
  marker.style.top = `${pageY}px`;
  marker.innerHTML = `<span>!</span>`;
  marker.title = pin.comment;
  marker.addEventListener("click", (event) => {
    event.stopPropagation();
    showReadOnlyPopover(pin, marker);
  });
  document.body.appendChild(marker);
}

let openPopover: HTMLElement | null = null;

function closePopover(): void {
  openPopover?.remove();
  openPopover = null;
}

function showReadOnlyPopover(pin: RemotePin, anchor: HTMLElement): void {
  closePopover();
  const popover = document.createElement("div");
  popover.className = cls("popover");
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${rect.left + window.scrollX}px`;
  popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
  popover.innerHTML = `
    <div>${escapeHtml(pin.comment)}</div>
    <div class="${cls("status")}">Status: ${pin.status.replace("_", " ")}</div>
  `;
  document.addEventListener("click", closePopover, { once: true });
  popover.addEventListener("click", (e) => e.stopPropagation());
  document.body.appendChild(popover);
  openPopover = popover;
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function loadExistingPins(config: WidgetConfig): Promise<void> {
  try {
    const url = new URL(`/api/public/${config.publicKey}/pins`, config.apiBase);
    url.searchParams.set("pageUrl", currentPageUrl());
    const res = await fetch(url.toString());
    if (!res.ok) return;
    const data = (await res.json()) as { pins: RemotePin[] };
    for (const pin of data.pins) renderMarker(config, pin);
  } catch {
    // A network hiccup shouldn't break the host page - existing markers just won't
    // appear until the next load.
  }
}

function setArmed(button: HTMLButtonElement, armed: boolean): void {
  button.classList.toggle(cls("active"), armed);
  document.body.style.cursor = armed ? "crosshair" : "";
}

function createButton(config: WidgetConfig): void {
  const button = document.createElement("button");
  button.className = cls("button");
  button.type = "button";
  button.setAttribute("aria-label", "Leave feedback");
  button.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V4a1 1 0 0 1 1-1h11l-2 5 2 5H7a1 1 0 0 0-1 1v7"/></svg>';

  let armed = false;

  button.addEventListener("click", () => {
    armed = !armed;
    setArmed(button, armed);
    if (armed) {
      document.addEventListener("click", onPageClick, { capture: true, once: true });
    }
  });

  function onPageClick(event: MouseEvent): void {
    if (event.target === button || button.contains(event.target as Node)) {
      return;
    }
    armed = false;
    setArmed(button, false);
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as Element;
    void openComposer(config, event, target);
  }

  document.body.appendChild(button);
}

async function openComposer(
  config: WidgetConfig,
  event: MouseEvent,
  target: Element,
): Promise<void> {
  const pinEditorUrl = new URL("./pin-editor.js", config.scriptSrc).toString();
  const mod = (await import(/* @vite-ignore */ pinEditorUrl)) as typeof import("./pin-editor.js");
  mod.openComposer(config, event, target, currentPageUrl(), (pin) => renderMarker(config, pin));
}

function init(): void {
  const config = readConfig();
  if (!config) {
    console.warn("[pageflag] widget script is missing a data-project attribute; not loading.");
    return;
  }
  injectStyles();
  createButton(config);
  void loadExistingPins(config);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
