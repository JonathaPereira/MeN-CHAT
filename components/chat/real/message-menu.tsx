"use client";
import { useEffect, useRef, type ReactNode } from "react";

// Native popovers use the top layer without a backdrop or a scroll lock.
export function MessageMenu({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    function position() {
      if (!menu) return;
      const rect = anchor.getBoundingClientRect();
      const width = menu.offsetWidth,
        height = menu.offsetHeight;
      menu.style.left = `${Math.max(8, Math.min(rect.right - width, innerWidth - width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, innerHeight - height - 8))}px`;
    }
    menu.showPopover();
    position();
    menu
      .querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    const dismiss = () => close.current();
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      menu.hidePopover();
      if (anchor.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [anchor]);
  return (
    <div
      ref={ref}
      popover="auto"
      className="message-action-menu"
      role="group"
      aria-label="Ações da mensagem"
      onToggle={(e) => {
        if (e.newState === "closed") close.current();
      }}
      onKeyDown={(e) => {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        const current = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const index =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : (current + (e.key === "ArrowUp" ? -1 : 1) + items.length) %
                  items.length;
          items[index]?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}
