import { describe, beforeEach, expect, it } from "vitest";
import { applyHighlightHoverState, configureHighlightElement, HIGHLIGHT_CLASS } from "../src/adapters/epubjs/highlightHover";

describe("highlight hover helpers", () => {
  let svgRoot: SVGSVGElement;
  let group: SVGGElement;
  let rect: SVGRectElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    svgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "10");
    rect.setAttribute("y", "10");
    rect.setAttribute("width", "120");
    rect.setAttribute("height", "18");
    group.classList.add(HIGHLIGHT_CLASS);
    group.appendChild(rect);
    svgRoot.appendChild(group);
    document.body.appendChild(svgRoot);
  });

  it("configures base highlight styling", () => {
    configureHighlightElement(group, undefined, { baseOpacity: 0.2, fillColor: "#ffee58" });

    expect(group.dataset.baseOpacity).toBe("0.2");
    expect(group.dataset.fillColor).toBe("#ffee58");
    expect(group.dataset.underlineColor).toBeDefined();
    expect(group.dataset.underlineHeight).toBeDefined();
    expect(rect.style.fill).toBe("#ffee58");
    expect(rect.style.getPropertyValue("fill-opacity")).toBe("0.2");
  });

  it("applies hover state and reverts correctly", () => {
    configureHighlightElement(group, undefined, { baseOpacity: 0.2 });

    applyHighlightHoverState(group, true);
    expect(group.getAttribute("data-hovered")).toBe("true");
    expect(rect.style.getPropertyValue("fill-opacity")).toBe("0.2");
    expect(group.querySelectorAll('[data-hover-underline="true"]').length).toBeGreaterThan(0);

    applyHighlightHoverState(group, false);
    expect(group.hasAttribute("data-hovered")).toBe(false);
    expect(group.querySelectorAll('[data-hover-underline="true"]').length).toBe(0);
  });
});
