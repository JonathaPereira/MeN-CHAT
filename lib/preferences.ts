export type Preferences = {
  notificationsEnabled: boolean;
  inAppAlerts: boolean;
  browserAlerts: boolean;
  messagePreview: boolean;
  notificationSound: boolean;
  onlyWhenAway: boolean;
  mutedChatIds: string[];
  autoImages: boolean;
  autoAudio: boolean;
  autoVideo: boolean;
  dataSaver: boolean;
  enterToSend: boolean;
  textSize: "small" | "normal" | "large";
  playbackRate: 1 | 1.25 | 1.5 | 2;
  noiseSuppression: boolean;
};
export const defaultPreferences: Preferences = {
  notificationsEnabled: true,
  inAppAlerts: true,
  browserAlerts: false,
  messagePreview: false,
  notificationSound: false,
  onlyWhenAway: true,
  mutedChatIds: [],
  autoImages: true,
  autoAudio: true,
  autoVideo: true,
  dataSaver: false,
  enterToSend: true,
  textSize: "normal",
  playbackRate: 1,
  noiseSuppression: true,
};

export function parsePreferences(raw: string): Preferences {
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return { ...defaultPreferences };
    const record = data as Record<string, unknown>;
    const result = { ...defaultPreferences };
    for (const key of Object.keys(
      defaultPreferences,
    ) as (keyof Preferences)[]) {
      if (
        typeof defaultPreferences[key] === "boolean" &&
        typeof record[key] === "boolean"
      ) {
        Object.assign(result, { [key]: record[key] });
      }
    }
    if (["small", "normal", "large"].includes(String(record.textSize)))
      result.textSize = record.textSize as Preferences["textSize"];
    if ([1, 1.25, 1.5, 2].includes(Number(record.playbackRate)))
      result.playbackRate = Number(
        record.playbackRate,
      ) as Preferences["playbackRate"];
    if (Array.isArray(record.mutedChatIds))
      result.mutedChatIds = record.mutedChatIds
        .filter((id): id is string => typeof id === "string" && id.length < 100)
        .slice(0, 100);
    return result;
  } catch {
    return { ...defaultPreferences };
  }
}
export function shouldNotify(
  settings: Preferences,
  chatId: string,
  away: boolean,
): boolean {
  return (
    settings.notificationsEnabled &&
    !settings.mutedChatIds.includes(chatId) &&
    (!settings.onlyWhenAway || away)
  );
}
export function shouldLoadMedia(
  settings: Preferences,
  kind: "image" | "audio" | "video",
): boolean {
  if (settings.dataSaver) return false;
  return kind === "image"
    ? settings.autoImages
    : kind === "audio"
      ? settings.autoAudio
      : settings.autoVideo;
}
