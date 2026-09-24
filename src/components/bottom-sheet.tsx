"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface BottomSheetProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ open, title, eyebrow, onClose, children, footer }: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    const owner = sheet?.parentElement;
    if (!sheet || !owner) return;

    const publishOccupiedHeight = () => {
      const ownerRect = owner.getBoundingClientRect();
      const sheetRect = sheet.getBoundingClientRect();
      owner.style.setProperty(
        "--sheet-occupied-height",
        `${Math.max(0, ownerRect.bottom - sheetRect.top)}px`,
      );
    };

    const observer = new ResizeObserver(publishOccupiedHeight);
    observer.observe(sheet);
    window.addEventListener("resize", publishOccupiedHeight);
    publishOccupiedHeight();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publishOccupiedHeight);
      owner.style.removeProperty("--sheet-occupied-height");
    };
  }, [open]);

  return (
    <section
      ref={sheetRef}
      aria-label={title}
      aria-hidden={!open}
      className={`terminal-sheet ${open ? "terminal-sheet--open" : "terminal-sheet--closed"}`}
    >
      <div className="terminal-sheet__handle" aria-hidden="true" />
      <div className="terminal-sheet__heading">
        <div>
          {eyebrow && <p className="terminal-sheet__eyebrow">{eyebrow}</p>}
          <h2 className="terminal-sheet__title">{title}</h2>
        </div>
        {onClose && open && (
          <button
            type="button"
            className="terminal-sheet__close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        )}
      </div>
      {open && <div className="terminal-sheet__body">{children}</div>}
      {open && footer && <div className="terminal-sheet__footer">{footer}</div>}
    </section>
  );
}
