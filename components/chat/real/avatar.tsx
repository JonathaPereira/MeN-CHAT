"use client";
import { memo } from "react";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatar } from "@/components/avatar";
export const RealAvatar = memo(function RealAvatar({
  client,
  name,
  path,
}: {
  client: SupabaseClient;
  name: string;
  path?: string | null;
}) {
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!path) return;
    let alive = true;
    async function load() {
      try {
        const { data, error } = await client.storage
          .from("menchat-avatars")
          .createSignedUrl(path!, 300);
        if (alive && !error && data)
          setPhoto({ path: path!, url: data.signedUrl });
      } catch {}
    }
    void load();
    const timer = setInterval(() => void load(), 240000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [client, path]);
  return (
    <Avatar
      name={name}
      photo={photo && photo.path === path ? photo.url : undefined}
    />
  );
});
