import { Brand } from "@/components/brand";
export default function Loading() {
  return (
    <main
      id="conteudo"
      className="app-loading"
      role="status"
      aria-label="Carregando MenChat"
    >
      <Brand large />
      <span className="app-loading-bar" />
      <p>Carregando suas conversas…</p>
    </main>
  );
}
