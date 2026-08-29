import html2canvas from "html2canvas";
import {
  cls,
  cssSelector,
  loadReporterIdentity,
  saveReporterIdentity,
  toPageCoords,
  toPercent,
  type WidgetConfig,
} from "./shared.js";

interface CreatedPin {
  id: string;
  x: number;
  y: number;
  comment: string;
  status: "open" | "in_progress" | "resolved";
}

export function openComposer(
  config: WidgetConfig,
  event: MouseEvent,
  target: Element,
  pageUrl: string,
  onCreated: (pin: CreatedPin) => void,
): void {
  const { pageX, pageY } = toPageCoords(event.clientX, event.clientY);
  const identity = loadReporterIdentity();

  const popover = document.createElement("div");
  popover.className = cls("popover");
  popover.style.left = `${Math.max(8, pageX - 140)}px`;
  popover.style.top = `${pageY + 16}px`;
  popover.innerHTML = `
    <textarea placeholder="What's wrong here?" autofocus></textarea>
    <input type="text" class="${cls("name")}" placeholder="Your name (optional)" value="${escapeAttr(identity.name ?? "")}">
    <input type="email" class="${cls("email")}" placeholder="Your email (optional)" value="${escapeAttr(identity.email ?? "")}">
    <div class="${cls("row")}">
      <button type="button" class="${cls("cancel")}">Cancel</button>
      <button type="button" class="${cls("submit")}">Send</button>
    </div>
    <div class="${cls("status")}" hidden></div>
  `;
  document.body.appendChild(popover);

  const textarea = popover.querySelector("textarea") as HTMLTextAreaElement;
  const nameInput = popover.querySelector(`.${cls("name")}`) as HTMLInputElement;
  const emailInput = popover.querySelector(`.${cls("email")}`) as HTMLInputElement;
  const submitButton = popover.querySelector(`.${cls("submit")}`) as HTMLButtonElement;
  const cancelButton = popover.querySelector(`.${cls("cancel")}`) as HTMLButtonElement;
  const statusEl = popover.querySelector(`.${cls("status")}`) as HTMLElement;
  textarea.focus();

  cancelButton.addEventListener("click", () => popover.remove());
  popover.addEventListener("click", (e) => e.stopPropagation());

  submitButton.addEventListener("click", () => {
    void submit();
  });

  async function submit(): Promise<void> {
    const comment = textarea.value.trim();
    if (!comment) {
      setStatus("Please describe the issue before sending.", true);
      return;
    }
    submitButton.disabled = true;
    setStatus("Capturing screenshot...", false);

    const { x, y } = toPercent(pageX, pageY);
    const identityToSave = { name: nameInput.value.trim(), email: emailInput.value.trim() };

    try {
      const screenshot = await captureScreenshot();
      setStatus("Sending...", false);

      const res = await fetch(new URL(`/api/public/${config.publicKey}/pins`, config.apiBase), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageUrl,
          selector: cssSelector(target),
          x,
          y,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          userAgent: navigator.userAgent,
          screenshot,
          comment,
          reporterName: identityToSave.name || undefined,
          reporterEmail: identityToSave.email || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `request failed (${res.status})`);
      }

      const data = (await res.json()) as { pin: CreatedPin };
      saveReporterIdentity(identityToSave);
      onCreated(data.pin);
      popover.remove();
    } catch (err) {
      submitButton.disabled = false;
      setStatus(`Couldn't save that pin: ${(err as Error).message}. Try again?`, true);
    }
  }

  function setStatus(message: string, isError: boolean): void {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = isError ? cls("error") : cls("status");
  }
}

async function captureScreenshot(): Promise<string | undefined> {
  try {
    const canvas = await html2canvas(document.body, {
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      useCORS: true,
      logging: false,
      ignoreElements: (el) =>
        !!(el as HTMLElement).closest?.(".pf-button, .pf-marker, .pf-popover"),
    });
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    // A page with an untaintable canvas (cross-origin images without CORS headers,
    // for example) can make html2canvas throw - the pin is still worth saving
    // without a screenshot rather than blocking the whole report.
    return undefined;
  }
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}
