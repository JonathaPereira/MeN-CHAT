import { Avatar } from "@/components/avatar";
import type { Contact } from "@/types/chat";

export function TypingIndicator({ people }: { people: Contact[] }) {
  if (!people.length) return null;
  const names = people.map((person) =>
    person.id === "assistant" ? "Assistente de teste" : person.name,
  );
  const text =
    names.length === 1
      ? `${names[0]} digitando…`
      : `${names.join(" e ")} estão digitando…`;
  return (
    <div role="status" className="typing-indicator">
      <div className="typing-avatars">
        {people.map((person) => (
          <span
            key={person.id}
            role="img"
            aria-label={`Avatar de ${person.name}`}
          >
            <Avatar name={person.name} color={person.color} />
          </span>
        ))}
      </div>
      <div className="min-w-0">
        <span className="block text-xs text-[var(--accent)]">{text}</span>
        <span className="text-[10px] text-[var(--muted)]">Simulação</span>
      </div>
      <span className="typing-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
