import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CallClient,
  CallMember,
  CallHeader,
} from "../../lib/calls/client";
const source = ts.transpileModule(
  await readFile("lib/calls/client.ts", "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
type FixtureCall = {
  id: string;
  video: boolean;
  state: "ringing" | "active" | "ended";
  members: CallMember[];
};
type FixtureSignal = {
  seq: number;
  sender_id: string;
  sender_device: string;
  recipient: string;
  device: string;
  kind: string;
  payload: Record<string, unknown>;
};
type Harness = {
  a: CallClient;
  b: CallClient;
  actor: string;
  friend: string;
  thread: string;
  signals: FixtureSignal[];
  fail: (code: string) => void;
  starts: () => number;
  release?: () => void;
  requested?: boolean;
  pending?: Promise<void>;
  late?: MediaStreamTrack[];
  aTracks?: MediaStreamTrack[];
};
type DebugClient = {
  peers: Map<
    string,
    {
      pc: RTCPeerConnection;
      negotiation: string;
      remoteNegotiation: string;
      pending: Map<string, RTCIceCandidateInit[]>;
    }
  >;
  cursor: number;
  configuration: () => Promise<unknown>;
};
declare global {
  interface Window {
    rtcHarness: Harness;
  }
}
async function harness(page: Page) {
  await page.context().grantPermissions(["camera", "microphone"]);
  await page.route("**/api/calls/config", (route) =>
    route.fulfill({
      json: {
        iceServers: [
          {
            urls: [process.env.MENCHAT_TEST_TURN_URL!],
            username: "fixture",
            credential: "fixture-only",
          },
        ],
        expires: Math.floor(Date.now() / 1000) + 1200,
        maxParticipants: 4,
      },
    }),
  );
  await page.route("**/api/calls/dispatch", (route) =>
    route.fulfill({ status: 202, body: "" }),
  );
  await page.goto("/entrar");
  await page.evaluate(async (code) => {
    const loaded = (await import(
      URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
    )) as { CallClient: typeof CallClient };
    const actor = "10000000-0000-4000-8000-000000000001",
      friend = "10000000-0000-4000-8000-000000000002",
      thread = "20000000-0000-4000-8000-000000000001";
    let call: FixtureCall | null = null,
      seq = 0,
      failState: string | null = null,
      startCount = 0;
    const signals: FixtureSignal[] = [];
    const header = (): CallHeader => ({
      id: call!.id,
      thread,
      caller: actor,
      video: call!.video,
      state: call!.state as "ringing" | "active",
      created: new Date().toISOString(),
    });
    // Only the RPC transport is replaced. PeerConnection, camera, microphone, codecs and RTP are real Chromium APIs.
    const client = (user: string) => ({
      rpc(name: string, args: Record<string, unknown>) {
        return {
          abortSignal() {
            return (async () => {
              if (name === "menchat_start_call") {
                startCount++;
                call = {
                  id: String(args.p_id),
                  video: Boolean(args.p_video),
                  state: "ringing",
                  members: [
                    {
                      id: actor,
                      name: "Pessoa A",
                      avatar: null,
                      state: "joined",
                      device: String(args.p_device),
                      mic: true,
                      video: Boolean(args.p_video),
                    },
                    {
                      id: friend,
                      name: "Pessoa B",
                      avatar: null,
                      state: "invited",
                      device: null,
                      mic: true,
                      video: false,
                    },
                  ],
                };
                return { data: args.p_id, error: null };
              }
              if (name === "menchat_call_inbox")
                return {
                  data:
                    call &&
                    call.state !== "ended" &&
                    call.members.find((p) => p.id === user)?.state === "invited"
                      ? [{ ...header(), mine: "invited" }]
                      : [],
                  error: null,
                };
              if (
                !call ||
                call.state === "ended" ||
                (args.p_call && args.p_call !== call.id)
              )
                return { data: null, error: { code: "42501" } };
              const member = call.members.find((p) => p.id === user)!;
              if (name === "menchat_join_call") {
                member.state = "joined";
                member.device = String(args.p_device);
                call.state = "active";
                return { data: true, error: null };
              }
              if (name === "menchat_leave_call") {
                member.state = "left";
                if (call.members.filter((p) => p.state === "joined").length < 2)
                  call.state = "ended";
                return { data: null, error: null };
              }
              if (name === "menchat_call_state") {
                if (failState) {
                  const code = failState;
                  failState = null;
                  return { data: null, error: { code } };
                }
                member.mic = Boolean(args.p_mic);
                member.video = Boolean(args.p_video);
                return {
                  data: JSON.parse(
                    JSON.stringify({ ...header(), members: call.members }),
                  ),
                  error: null,
                };
              }
              if (name === "menchat_call_signal") {
                signals.push({
                  seq: ++seq,
                  sender_id: user,
                  sender_device: String(args.p_device),
                  recipient: String(args.p_to),
                  device: String(args.p_to_device),
                  kind: String(args.p_kind),
                  payload: args.p_payload as Record<string, unknown>,
                });
                return { data: true, error: null };
              }
              if (name === "menchat_call_signals")
                return {
                  data: signals.filter(
                    (row) =>
                      row.recipient === user &&
                      row.device === args.p_device &&
                      row.seq > Number(args.p_after),
                  ),
                  error: null,
                };
              return { data: null, error: { code: "PGRST202" } };
            })();
          },
        };
      },
    });
    const a = new loaded.CallClient(
        client(actor) as unknown as SupabaseClient,
        actor,
        () => {},
        () => {},
      ),
      b = new loaded.CallClient(
        client(friend) as unknown as SupabaseClient,
        friend,
        () => {},
        () => {},
      );
    window.rtcHarness = {
      a,
      b,
      actor,
      friend,
      thread,
      signals,
      fail: (code) => {
        failState = code;
      },
      starts: () => startCount,
    };
    await Promise.all([a.initialize(), b.initialize()]);
  }, source);
}
test("WebRTC conecta áudio/vídeo entre dois clientes e libera os dispositivos ao encerrar", async ({
  page,
}) => {
  test.slow();
  await harness(page);
  try {
    await page.evaluate(async () => {
      const h = window.rtcHarness;
      await h.a.start(h.thread, true);
    });
    await expect
      .poll(() => page.evaluate(() => !!window.rtcHarness.b.view.incoming), {
        timeout: 12000,
      })
      .toBe(true);
    await page.evaluate(async () => {
      await window.rtcHarness.b.accept();
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const h = window.rtcHarness;
            return h.a.view.streams.size === 1 && h.b.view.streams.size === 1;
          }),
        { timeout: 20000 },
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const client = window.rtcHarness.a as unknown as DebugClient,
              peer = [...client.peers.values()][0];
            const stats = await peer.pc.getStats();
            let received = false;
            stats.forEach((record) => {
              const item = record as RTCInboundRtpStreamStats;
              if (
                item.type === "inbound-rtp" &&
                item.kind === "audio" &&
                (item.bytesReceived ?? 0) > 0
              )
                received = true;
            });
            return received;
          }),
        { timeout: 15000 },
      )
      .toBe(true);
    await page.evaluate(() => {
      window.rtcHarness.a.mute();
    });
    expect(
      await page.evaluate(
        () => window.rtcHarness.a.view.local!.getAudioTracks()[0].enabled,
      ),
    ).toBe(false);
    await page.evaluate(async () => {
      await window.rtcHarness.a.camera();
    });
    expect(
      await page.evaluate(
        () => window.rtcHarness.a.view.local!.getVideoTracks().length,
      ),
    ).toBe(0);
    await page.evaluate(async () => {
      await window.rtcHarness.a.camera();
    });
    expect(
      await page.evaluate(
        () => window.rtcHarness.a.view.local!.getVideoTracks()[0].readyState,
      ),
    ).toBe("live");
    await page.evaluate(() => {
      const h = window.rtcHarness;
      h.aTracks = h.a.view.local!.getTracks();
      h.fail("FETCH_ERROR");
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.rtcHarness.a.view.error || window.rtcHarness.b.view.error,
          ),
        { timeout: 6000 },
      )
      .toContain("instável");
    expect(await page.evaluate(() => !!window.rtcHarness.a.view.active)).toBe(
      true,
    );
    await page.evaluate(async () => {
      await window.rtcHarness.a.end();
    });
    expect(
      await page.evaluate(() =>
        window.rtcHarness.aTracks!.every(
          (track) => track.readyState === "ended",
        ),
      ),
    ).toBe(true);
    await expect
      .poll(
        () => page.evaluate(() => window.rtcHarness.b.view.active === null),
        { timeout: 7000 },
      )
      .toBe(true);
  } finally {
    await page.evaluate(() => {
      const h = window.rtcHarness;
      h?.a.destroy();
      h?.b.destroy();
    });
  }
});
test("cancelar antes de a permissão resolver impede captura e chamada tardias", async ({
  page,
}) => {
  await harness(page);
  try {
    await page.evaluate(() => {
      const h = window.rtcHarness,
        original = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices,
        );
      const gate = new Promise<void>((resolve) => {
        h.release = resolve;
      });
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        h.requested = true;
        await gate;
        const stream = await original(constraints);
        h.late = stream.getTracks();
        return stream;
      };
      h.pending = h.a.start(h.thread, true);
    });
    await expect
      .poll(() => page.evaluate(() => !!window.rtcHarness.requested))
      .toBe(true);
    await page.evaluate(async () => {
      const h = window.rtcHarness;
      await h.a.end();
      h.release!();
      await h.pending;
    });
    expect(
      await page.evaluate(() =>
        window.rtcHarness.late!.every((track) => track.readyState === "ended"),
      ),
    ).toBe(true);
    expect(await page.evaluate(() => window.rtcHarness.starts())).toBe(0);
  } finally {
    await page.evaluate(() => {
      const h = window.rtcHarness;
      h?.a.destroy();
      h?.b.destroy();
    });
  }
});
test("falha atrasada de uma tentativa cancelada não encerra a chamada seguinte", async ({
  page,
}) => {
  await harness(page);
  try {
    await page.evaluate(() => {
      const h = window.rtcHarness,
        debug = h.a as unknown as DebugClient,
        original = debug.configuration.bind(debug);
      let first = true;
      const gate = new Promise<void>((resolve) => {
        h.release = resolve;
      });
      debug.configuration = async () => {
        if (first) {
          first = false;
          h.requested = true;
          await gate;
          throw new Error("fixture delayed failure");
        }
        return original();
      };
      h.pending = h.a.start(h.thread, false);
    });
    await expect
      .poll(() => page.evaluate(() => !!window.rtcHarness.requested))
      .toBe(true);
    await page.evaluate(async () => {
      const h = window.rtcHarness;
      await h.a.end();
      await h.a.start(h.thread, true);
      h.release!();
      await h.pending;
    });
    expect(await page.evaluate(() => !!window.rtcHarness.a.view.active)).toBe(
      true,
    );
    expect(
      await page.evaluate(() =>
        window.rtcHarness.a.view
          .local!.getTracks()
          .every((track) => track.readyState === "live"),
      ),
    ).toBe(true);
  } finally {
    await page.evaluate(() => {
      const h = window.rtcHarness;
      h?.a.destroy();
      h?.b.destroy();
    });
  }
});
test("APIs móveis e configuração de chamadas exigem identidade validada", async ({
  request,
}) => {
  for (const path of ["/api/mobile/calls/config", "/api/calls/config"])
    expect((await request.get(path)).status()).toBe(401);
  for (const path of [
    "/api/mobile/invitations",
    "/api/mobile/push/dispatch",
    "/api/mobile/calls/dispatch",
  ])
    expect(
      (
        await request.post(path, {
          data: { id: "arbitrario", email: "test@example.test" },
        })
      ).status(),
    ).toBe(401);
});
