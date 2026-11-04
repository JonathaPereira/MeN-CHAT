"use client";
import { Download } from "lucide-react";
export function InstallAppButton() {
  return (
    <button
      className="install-entry"
      onClick={() => window.dispatchEvent(new Event("menchat:install"))}
    >
      <Download size={19} aria-hidden="true" /> Baixar app Android
    </button>
  );
}
