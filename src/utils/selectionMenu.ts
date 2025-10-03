export type SelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DropdownPlacement = {
  left: number;
  top: number;
  placement: "above" | "below";
};

const SAFETY_MARGIN = 12;
const ESTIMATED_DROPDOWN_HEIGHT = 160;

export function calculateDropdownPosition(
  anchor: SelectionRect,
  containerWidth: number,
  containerHeight: number
): DropdownPlacement {
  const midpointX = anchor.left + anchor.width / 2;

  let placement: "above" | "below" = "above";
  let top = anchor.top - SAFETY_MARGIN;

  if (top < SAFETY_MARGIN) {
    placement = "below";
    top = anchor.top + anchor.height + SAFETY_MARGIN;
  }

  if (placement === "below" && top + ESTIMATED_DROPDOWN_HEIGHT > containerHeight - SAFETY_MARGIN) {
    const candidateTop = anchor.top - SAFETY_MARGIN;
    if (candidateTop >= SAFETY_MARGIN) {
      placement = "above";
      top = candidateTop;
    }
  }

  if (placement === "above" && top < SAFETY_MARGIN) {
    placement = "below";
    top = anchor.top + anchor.height + SAFETY_MARGIN;
  }

  const clampedLeft = Math.min(Math.max(midpointX, SAFETY_MARGIN), containerWidth - SAFETY_MARGIN);

  return {
    left: clampedLeft,
    top,
    placement,
  };
}
