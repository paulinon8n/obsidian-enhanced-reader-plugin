import { describe, expect, it } from "vitest";
import { calculateDropdownPosition, type SelectionRect } from "../src/utils/selectionMenu";

describe("calculateDropdownPosition", () => {
  const containerWidth = 800;
  const containerHeight = 600;

  const baseRect: SelectionRect = {
    left: 200,
    top: 300,
    width: 100,
    height: 20,
  };

  it("positions the dropdown above when there is enough space", () => {
    const result = calculateDropdownPosition(baseRect, containerWidth, containerHeight);
    expect(result.placement).toBe("above");
    expect(result.top).toBeLessThan(baseRect.top);
  });

  it("falls back below when anchor is near the top", () => {
    const nearTopRect = { ...baseRect, top: 10 };
    const result = calculateDropdownPosition(nearTopRect, containerWidth, containerHeight);
    expect(result.placement).toBe("below");
    expect(result.top).toBeGreaterThan(nearTopRect.top);
  });

  it("clamps horizontally when anchor is near the edges", () => {
    const nearRightRect = { ...baseRect, left: containerWidth - 10 };
    const result = calculateDropdownPosition(nearRightRect, containerWidth, containerHeight);
    expect(result.left).toBeLessThanOrEqual(containerWidth - 12);

    const nearLeftRect = { ...baseRect, left: 0 };
    const leftResult = calculateDropdownPosition(nearLeftRect, containerWidth, containerHeight);
    expect(leftResult.left).toBeGreaterThanOrEqual(12);
  });

  it("bounces back above when there is no space below", () => {
    const nearBottomRect = { ...baseRect, top: containerHeight - 20 };
    const result = calculateDropdownPosition(nearBottomRect, containerWidth, containerHeight);
    expect(result.placement).toBe("above");
  });
});
