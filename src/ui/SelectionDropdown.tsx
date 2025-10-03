import * as React from "react";

type SelectionDropdownProps = {
  position: { left: number; top: number };
  placement: "above" | "below";
  hasExistingHighlight: boolean;
  onHighlight: () => void;
  onRemoveHighlight?: () => void;
  onExport: () => void;
  onCancel: () => void;
};

export const SelectionDropdown = React.forwardRef<HTMLDivElement, SelectionDropdownProps>(
  ({
    position,
    placement,
    hasExistingHighlight,
    onHighlight,
    onRemoveHighlight,
    onExport,
    onCancel,
  }, forwardedRef) => {
    const localRef = React.useRef<HTMLDivElement | null>(null);

    const assignRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    React.useEffect(() => {
      const container = localRef.current;
      if (!container) return;
      const firstButton = container.querySelector<HTMLButtonElement>("button");
      firstButton?.focus();
    }, [position.left, position.top, placement]);

    const style: React.CSSProperties = {
      position: "absolute",
      left: position.left,
      top: position.top,
      transform: `translate(-50%, ${placement === "above" ? "-100%" : "0"})`,
      zIndex: 999,
    };

    return (
      <div
        ref={assignRef}
        className="enhanced-reader-selection-dropdown"
        style={style}
        role="menu"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {!hasExistingHighlight && (
          <button type="button" onClick={onHighlight} role="menuitem">
            Destacar
          </button>
        )}
        {hasExistingHighlight && onRemoveHighlight && (
          <button type="button" onClick={onRemoveHighlight} role="menuitem">
            Remover destaque
          </button>
        )}
        <button type="button" onClick={onExport} role="menuitem">
          Enviar para a nota
        </button>
        <button type="button" className="secondary-action" onClick={onCancel} role="menuitem">
          Cancelar
        </button>
      </div>
    );
  }
);

SelectionDropdown.displayName = "SelectionDropdown";
