// Servidor isolado, com Auth/HTTP fictícios. Nenhum bypass é incluído na aplicação.
import { spawn } from "node:child_process";
const preload = new URL(
  "../tests/support/mock-supabase-server.mjs",
  import.meta.url,
).href;
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3106",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://menchat.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ui_test",
      SUPABASE_SECRET_KEY: "",
      // Keep optional external services inert even when .env.local is configured.
      MENCHAT_FIREBASE_APP_ID: "",
      MENCHAT_FIREBASE_PROJECT_ID: "",
      MENCHAT_FIREBASE_SENDER_ID: "",
      MENCHAT_FIREBASE_API_KEY: "",
      MENCHAT_FIREBASE_CLIENT_EMAIL: "",
      MENCHAT_FIREBASE_PRIVATE_KEY: "",
      MENCHAT_CALLS_ENABLED: "false",
      MENCHAT_TURN_URLS: "",
      MENCHAT_TURN_SECRET: "",
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${preload}`]
        .filter(Boolean)
        .join(" "),
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
