import type { Conversation } from "@/types/conversation";

// Dados inteiramente fictícios. Não representam contas, presença ou mensagens reais.
export const conversations: Conversation[] = [
  { id: "familia", name: "Família reunida", initials: "FR", color: "sage", preview: "Ana: Domingo tem almoço por aqui! 🥗", time: "12:42", unread: 3, kind: "group", description: "O ponto de encontro da família, dos bons dias aos almoços de domingo." },
  { id: "ana", name: "Ana Oliveira", initials: "AO", color: "peach", preview: "Achei aquela foto da nossa viagem!", time: "11:38", unread: 1, kind: "person", description: "Uma conversa para compartilhar os pequenos momentos do dia." },
  { id: "amigos", name: "Os de sempre", initials: "OS", color: "lavender", preview: "Pedro: Quem topa um filme hoje? 🍿", time: "10:15", unread: 0, kind: "group", description: "Amigos de longa data e planos que começam com uma boa conversa." },
  { id: "lucas", name: "Lucas Santos", initials: "LS", color: "blue", preview: "Valeu pela dica! Depois te conto.", time: "Ontem", unread: 0, kind: "person", description: "Ideias, novidades e aquela recomendação que vale compartilhar." },
  { id: "julia", name: "Júlia Costa", initials: "JC", color: "sage", preview: "Combinado, até sábado! ✨", time: "Ontem", unread: 0, kind: "person", description: "Um espaço para manter a amizade por perto." },
];
