"use client";

import { RefObject, useEffect, useRef } from "react";

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AccessibleDialog({
  children,
  label,
  onClose,
  returnFocusRef
}: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = returnFocusRef?.current;
    const elements = dialog?.querySelectorAll<HTMLElement>(focusable);
    elements?.[0]?.focus();
    return () => {
      window.setTimeout(() => returnFocus?.focus(), 0);
    };
  }, [returnFocusRef]);

  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = [...(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? [])];
    if (!elements.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-label={label} onKeyDown={keyDown} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
