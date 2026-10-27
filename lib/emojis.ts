export const emojiCategories = [
  {
    name: "Carinhas",
    items: [
      ["😀", "Sorriso"],
      ["😂", "Rindo"],
      ["🥹", "Emocionado"],
      ["😍", "Apaixonado"],
      ["🥰", "Carinho"],
      ["😘", "Beijo"],
      ["😎", "Estiloso"],
      ["🤔", "Pensando"],
      ["😭", "Chorando"],
      ["😴", "Sono"],
      ["😡", "Bravo"],
      ["🤯", "Surpreso"],
      ["🥳", "Festa"],
      ["😅", "Aliviado"],
      ["🙃", "De cabeça para baixo"],
      ["🤗", "Abraço"],
    ],
  },
  {
    name: "Gestos e amor",
    items: [
      ["👍", "Legal"],
      ["👎", "Não gostei"],
      ["👏", "Palmas"],
      ["🙌", "Comemorar"],
      ["🙏", "Obrigado"],
      ["👋", "Olá"],
      ["🤝", "Acordo"],
      ["💪", "Força"],
      ["❤️", "Coração"],
      ["💚", "Coração verde"],
      ["💜", "Coração roxo"],
      ["💔", "Coração partido"],
      ["💕", "Amor"],
      ["✨", "Brilho"],
      ["🔥", "Fogo"],
      ["💯", "Cem pontos"],
    ],
  },
  {
    name: "Dia a dia",
    items: [
      ["☀️", "Sol"],
      ["🌙", "Lua"],
      ["🌧️", "Chuva"],
      ["🌻", "Flor"],
      ["🐶", "Cachorro"],
      ["🐱", "Gato"],
      ["🍕", "Pizza"],
      ["🍿", "Pipoca"],
      ["☕", "Café"],
      ["🎂", "Bolo"],
      ["🎉", "Confete"],
      ["🎁", "Presente"],
      ["🎮", "Jogo"],
      ["🎵", "Música"],
      ["⚽", "Futebol"],
      ["✅", "Confirmado"],
    ],
  },
];
export function searchEmojis(query: string) {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return emojiCategories
    .flatMap((category) => category.items)
    .filter(
      ([emoji, label]) =>
        normalize(label).includes(normalize(query.trim())) ||
        emoji === query.trim(),
    );
}
