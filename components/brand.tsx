import { MessagesSquare } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${light ? "text-white" : "text-ink"}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${light ? "bg-white/15" : "bg-pine text-white"}`}>
        <MessagesSquare size={23} aria-hidden="true" />
      </span>
      <span className="text-lg font-extrabold tracking-tight">M&N <span className="font-normal">CHAT</span></span>
    </div>
  );
}
