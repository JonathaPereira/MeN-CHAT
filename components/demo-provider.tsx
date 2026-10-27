"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePreferences } from "@/components/preferences-provider";
import { contacts, initialChats, initialProfile } from "@/lib/data/chat";
import { automatedReply } from "@/lib/auto-reply";
import { generateUserCode } from "@/lib/user-code";
import { chatMembers } from "@/lib/chat-privacy";
import { createDemoId } from "@/lib/demo-id";
import type { Attachment, Chat, Contact, Profile, Message } from "@/types/chat";

const PROFILE_KEY = "mn-chat-demo-profile-v1";
const initialSnapshot = JSON.stringify(initialProfile);
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("mn-profile", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("mn-profile", callback);
  };
}
function getSnapshot() {
  try {
    return localStorage.getItem(PROFILE_KEY) || initialSnapshot;
  } catch {
    return initialSnapshot;
  }
}
function parseProfile(snapshot: string): Profile {
  try {
    const data = JSON.parse(snapshot);
    if (
      typeof data.name === "string" &&
      data.name.trim() &&
      data.name.length <= 50 &&
      typeof data.status === "string" &&
      data.status.length <= 140 &&
      typeof data.photo === "string" &&
      (!data.photo ||
        /^data:image\/(jpeg|png|webp);base64,/.test(data.photo)) &&
      typeof data.code === "string" &&
      /^[A-Z0-9]{6}$/.test(data.code)
    )
      return data;
  } catch {
    /* Local data can be absent or corrupt. */
  }
  return initialProfile;
}

type DemoContextValue = {
  profile: Profile;
  chats: Chat[];
  typing: Record<string, string[]>;
  setActiveChat: (id: string | null) => void;
  saveProfile: (profile: Profile) => boolean;
  registerProfile: (name: string) => boolean;
  openPrivate: (contact: Contact) => string;
  createGroup: (name: string, memberIds: string[]) => string;
  sendMessage: (
    chatId: string,
    text: string,
    attachments: Attachment[],
  ) => void;
  markRead: (chatId: string) => void;
  fileUrl: (file: File) => string;
  releaseUrl: (url: string) => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const { notifyIncoming, settings } = usePreferences();
  const privacy = useRef(settings);
  useEffect(() => {
    privacy.current = settings;
  }, [settings]);
  const activeChat = useRef<string | null>(null);
  const setActiveChat = useCallback((id: string | null) => {
    activeChat.current = id;
  }, []);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => initialSnapshot,
  );
  const profile = useMemo(() => parseProfile(snapshot), [snapshot]);
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const activeTimers = timers.current;
    const activeUrls = urls.current;
    return () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
      activeUrls.clear();
    };
  }, []);

  const markRead = useCallback((chatId: string) => {
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId && chat.unread > 0 ? { ...chat, unread: 0 } : chat,
      ),
    );
  }, []);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible" && activeChat.current)
        markRead(activeChat.current);
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [markRead]);
  const releaseUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }, []);

  function saveProfile(next: Profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("mn-profile"));
      return true;
    } catch {
      return false;
    }
  }
  function openPrivate(contact: Contact) {
    const existing = chats.find(
      (chat) => chat.kind === "person" && chat.memberIds.includes(contact.id),
    );
    if (existing) return existing.id;
    const id = createDemoId();
    setChats((current) => [
      ...current,
      {
        id,
        name: contact.name,
        kind: "person",
        memberIds: [contact.id],
        color: contact.color,
        unread: 0,
        messages: [],
      },
    ]);
    return id;
  }
  function createGroup(name: string, memberIds: string[]) {
    const id = createDemoId();
    setChats((current) => [
      ...current,
      {
        id,
        name: name.trim(),
        kind: "group",
        memberIds: [...new Set(memberIds)],
        color: "sage",
        unread: 0,
        messages: [],
      },
    ]);
    return id;
  }
  function sendMessage(
    chatId: string,
    text: string,
    attachments: Attachment[],
  ) {
    if (!text.trim() && !attachments.length) return;
    const target = chats.find((chat) => chat.id === chatId);
    if (!target) return;
    const members = chatMembers(target, contacts);
    const message: Message = {
      id: createDemoId(),
      text: text.trim(),
      outgoing: true,
      readBy: [],
      time: new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
      attachments,
    };
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, message] }
          : chat,
      ),
    );
    const previous = timers.current.get(chatId);
    if (previous) clearTimeout(previous);
    setTyping((current) => ({
      ...current,
      [chatId]: members
        .filter((contact) => contact.privacy.showTyping)
        .slice(0, 2)
        .map((contact) => contact.id),
    }));
    timers.current.set(
      chatId,
      setTimeout(() => {
        const reply = {
          id: createDemoId(),
          text: automatedReply(text, attachments.length > 0),
          outgoing: false,
          author:
            members[0]?.id === "assistant"
              ? "Assistente de teste"
              : `${members[0]?.name ?? "Participante"} · simulação`,
          time: new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date()),
          attachments: [],
        };
        const away =
          activeChat.current !== chatId ||
          document.visibilityState !== "visible";
        notifyIncoming({
          chatId,
          title: chats.find((chat) => chat.id === chatId)?.name || "M&N CHAT",
          text: reply.text,
          away,
        });
        setChats((current) =>
          current.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  unread: away ? chat.unread + 1 : 0,
                  messages: [
                    ...chat.messages.map((item) =>
                      item.id === message.id
                        ? {
                            ...item,
                            readBy: privacy.current.readReceipts
                              ? members
                                  .filter(
                                    (contact) => contact.privacy.readReceipts,
                                  )
                                  .map((contact) => ({
                                    contactId: contact.id,
                                    time: reply.time,
                                  }))
                              : [],
                          }
                        : item,
                    ),
                    reply,
                  ],
                }
              : chat,
          ),
        );
        setTyping((current) => {
          const next = { ...current };
          delete next[chatId];
          return next;
        });
        timers.current.delete(chatId);
      }, 1100),
    );
  }
  return (
    <DemoContext.Provider
      value={{
        profile,
        chats,
        typing,
        setActiveChat,
        saveProfile,
        registerProfile: (name) =>
          saveProfile({
            ...initialProfile,
            name: name.trim(),
            code: generateUserCode([
              ...contacts.map((contact) => contact.code),
              profile.code,
            ]),
          }),
        openPrivate,
        createGroup,
        sendMessage,
        markRead,
        fileUrl: (file) => {
          const url = URL.createObjectURL(file);
          urls.current.add(url);
          return url;
        },
        releaseUrl,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo precisa de DemoProvider");
  return value;
}
