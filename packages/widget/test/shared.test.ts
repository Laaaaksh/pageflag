import { describe, it, expect, beforeEach } from "vitest";
import {
  cssSelector,
  toPercent,
  fromPercent,
  readConfig,
  loadReporterIdentity,
  saveReporterIdentity,
} from "../src/shared.js";

describe("cssSelector", () => {
  it("prefers an id over a structural path", () => {
    document.body.innerHTML = `<div><h1 id="hero-title">Hello</h1></div>`;
    const el = document.getElementById("hero-title")!;
    expect(cssSelector(el)).toBe("#hero-title");
  });

  it("builds a structural path with nth-of-type for ambiguous siblings", () => {
    document.body.innerHTML = `<section><p>one</p><p>two</p><p>three</p></section>`;
    const second = document.querySelectorAll("p")[1];
    expect(cssSelector(second)).toBe("section > p:nth-of-type(2)");
  });

  it("does not add nth-of-type when the tag is unique among siblings", () => {
    document.body.innerHTML = `<section><h2>Title</h2><p>text</p></section>`;
    const h2 = document.querySelector("h2")!;
    expect(cssSelector(h2)).toBe("section > h2");
  });

  it("anchors the path on the nearest ancestor id instead of walking to body", () => {
    document.body.innerHTML = `<div id="card"><div><span>x</span></div></div>`;
    const span = document.querySelector("span")!;
    expect(cssSelector(span)).toBe("#card > div > span");
  });
});

describe("toPercent / fromPercent", () => {
  it("round-trips page coordinates through percentages", () => {
    Object.defineProperty(document.documentElement, "scrollWidth", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 4000,
      configurable: true,
    });

    const { x, y } = toPercent(500, 1000);
    expect(x).toBeCloseTo(25);
    expect(y).toBeCloseTo(25);

    const { pageX, pageY } = fromPercent(x, y);
    expect(pageX).toBeCloseTo(500);
    expect(pageY).toBeCloseTo(1000);
  });
});

describe("readConfig", () => {
  it("reads the project key and derives the API base from the script src", () => {
    document.body.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://pageflag.example.com/widget.js";
    script.dataset.project = "pf_abc123";
    document.body.appendChild(script);
    Object.defineProperty(document, "currentScript", { value: script, configurable: true });

    const config = readConfig(document);
    expect(config).toEqual({
      publicKey: "pf_abc123",
      apiBase: "https://pageflag.example.com",
      scriptSrc: "https://pageflag.example.com/widget.js",
    });
  });

  it("returns null when data-project is missing", () => {
    document.body.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://pageflag.example.com/widget.js";
    document.body.appendChild(script);
    Object.defineProperty(document, "currentScript", { value: script, configurable: true });

    expect(readConfig(document)).toBeNull();
  });

  it("honors an explicit data-api-base override", () => {
    document.body.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://cdn.example.com/pageflag/widget.js";
    script.dataset.project = "pf_abc123";
    script.dataset.apiBase = "https://self-hosted.internal";
    document.body.appendChild(script);
    Object.defineProperty(document, "currentScript", { value: script, configurable: true });

    expect(readConfig(document)?.apiBase).toBe("https://self-hosted.internal");
  });
});

describe("reporter identity persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips through localStorage", () => {
    expect(loadReporterIdentity()).toEqual({});
    saveReporterIdentity({ name: "Jamie", email: "jamie@example.com" });
    expect(loadReporterIdentity()).toEqual({ name: "Jamie", email: "jamie@example.com" });
  });
});
