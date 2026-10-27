import { MessagesSquare } from "lucide-react";

export function Brand({
  light = false,
  large = false,
}: {
  light?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={`menchat-brand ${light ? "text-white" : "text-[var(--ink)]"} ${large ? "brand-large" : ""}`}
    >
      <span className="brand-mark">
        <MessagesSquare
          size={large ? 32 : 23}
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </span>
      <span className="brand-word">
        Men<span>Chat</span>
      </span>
    </div>
  );
}
