import type { SupabaseClient } from "@supabase/supabase-js";
export type CallMember = {
  id: string;
  name: string;
  avatar: string | null;
  state: "invited" | "joined" | "declined" | "left";
  device: string | null;
  mic: boolean;
  video: boolean;
};
export type CallHeader = {
  id: string;
  thread: string;
  caller: string;
  video: boolean;
  state: "ringing" | "active";
  mine?: string;
  created: string;
};
export type CallSnapshot = CallHeader & { members: CallMember[] };
type Signal = {
  seq: number;
  sender_id: string;
  sender_device: string;
  kind: string;
  payload: Record<string, unknown>;
};
type Configuration = {
  iceServers: RTCIceServer[];
  expires: number;
  maxParticipants: number;
};
type Peer = {
  pc: RTCPeerConnection;
  device: string;
  stream: MediaStream;
  negotiation: string;
  remoteNegotiation: string;
  pending: Map<string, RTCIceCandidateInit[]>;
  offering: boolean;
  restarts: number;
  disconnected?: ReturnType<typeof setTimeout>;
};
export type CallView = {
  ready: boolean;
  busy: boolean;
  active: CallSnapshot | null;
  incoming: CallHeader | null;
  local: MediaStream | null;
  streams: Map<string, MediaStream>;
  mic: boolean;
  video: boolean;
  error: string;
};
class CallFailure extends Error {
  constructor(
    message: string,
    readonly terminal: boolean,
  ) {
    super(message);
  }
}
const empty = (): CallView => ({
  ready: false,
  busy: false,
  active: null,
  incoming: null,
  local: null,
  streams: new Map(),
  mic: true,
  video: false,
  error: "",
});
/** No SDP, ICE, media or credentials are written to browser storage. */
export class CallClient {
  view = empty();
  private device = crypto.randomUUID();
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private generation = 0;
  private cursor = 0;
  private config?: Configuration;
  private nextConfig = 0;
  private peers = new Map<string, Peer>();
  private outgoing: {
    id: string;
    to: string;
    device: string;
    kind: string;
    payload: Record<string, unknown>;
  }[] = [];
  private sending = false;
  private lastIncoming: string | null = null;
  private callId: string | null = null;
  private lastContact = Date.now();
  constructor(
    private client: SupabaseClient,
    private actor: string,
    private emit: (state: CallView) => void,
    private incomingTone: () => void,
  ) {}
  private change(value: Partial<CallView>) {
    this.view = { ...this.view, ...value };
    if (!this.closed) this.emit(this.view);
  }
  private async rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await this.client
      .rpc(name, args)
      .abortSignal(AbortSignal.timeout(10000));
    if (error)
      throw new CallFailure(
        error.code === "42501"
          ? "A chamada terminou ou seu acesso foi encerrado."
          : "Não foi possível atualizar a chamada. Ela pode estar cheia, encerrada ou indisponível.",
        ["42501", "23514", "PGRST202"].includes(error.code),
      );
    return data as T;
  }
  private async configuration(): Promise<Configuration> {
    const response = await fetch("/api/calls/config", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        "Chamadas aguardam a configuração de conexão do administrador.",
      );
    const value = (await response.json()) as Configuration;
    if (
      !Array.isArray(value.iceServers) ||
      !Number.isFinite(value.expires) ||
      value.maxParticipants !== 4
    )
      throw new Error("Configuração de chamada indisponível.");
    this.config = value;
    this.nextConfig = Date.now() + 15 * 60_000;
    return value;
  }
  async initialize() {
    try {
      await this.configuration();
      this.change({ ready: true });
    } catch {
      this.change({ ready: false });
    }
    if (!this.closed) void this.poll();
  }
  private async poll() {
    if (this.closed) return;
    const id = this.callId,
      epoch = this.generation;
    try {
      if (!this.view.ready) {
        if (Date.now() >= this.nextConfig) {
          this.nextConfig = Date.now() + 60_000;
          try {
            await this.configuration();
            this.change({ ready: true });
          } catch {
            /* configuration remains visibly unavailable */
          }
        }
      } else if (!this.view.busy) {
        if (id) {
          const value = await this.rpc<CallSnapshot>("menchat_call_state", {
            p_call: id,
            p_device: this.device,
            p_mic: this.view.mic,
            p_video: this.view.video,
          });
          if (this.closed || epoch !== this.generation || this.callId !== id)
            return;
          this.lastContact = Date.now();
          this.change({ active: value });
          this.reconcile(value);
          const signals = await this.rpc<Signal[]>("menchat_call_signals", {
            p_call: id,
            p_device: this.device,
            p_after: this.cursor,
          });
          for (const signal of signals) {
            if (this.closed || epoch !== this.generation) break;
            await this.receive(signal);
            this.cursor = signal.seq;
          }
          if (Date.now() > this.nextConfig) {
            this.nextConfig = Date.now() + 30_000;
            try {
              const fresh = await this.configuration();
              for (const [user, peer] of this.peers) {
                peer.pc.setConfiguration({
                  iceServers: fresh.iceServers,
                  bundlePolicy: "max-bundle",
                });
                this.restart(user);
              }
            } catch {
              this.change({
                error:
                  "Não foi possível renovar a conexão. Tentando novamente.",
              });
            }
          }
        } else {
          const rows = await this.rpc<CallHeader[]>("menchat_call_inbox", {
            p_device: this.device,
          });
          if (this.closed || epoch !== this.generation) return;
          const incoming = rows.find((row) => row.mine === "invited") || null;
          this.change({ incoming });
          if (incoming && incoming.id !== this.lastIncoming) {
            this.lastIncoming = incoming.id;
            this.incomingTone();
          }
        }
      }
    } catch (error) {
      if (epoch !== this.generation || id !== this.callId) return;
      if (this.callId) {
        if (
          (error instanceof CallFailure && error.terminal) ||
          Date.now() - this.lastContact > 40_000
        ) {
          this.release();
          this.change({
            active: null,
            local: null,
            streams: new Map(),
            error:
              error instanceof Error
                ? error.message
                : "A chamada foi interrompida.",
          });
        } else
          this.change({
            error: "Conexão instável. Tentando sincronizar a chamada…",
          });
      }
    } finally {
      if (!this.closed)
        this.timer = setTimeout(
          () => void this.poll(),
          this.callId ? 1000 : 2500,
        );
    }
  }
  private async media(video: boolean): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Este navegador não oferece microfone/câmera. Use HTTPS e um navegador atualizado.",
      );
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: video
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 24, max: 30 },
              facingMode: "user",
            }
          : false,
      });
    } catch {
      throw new Error(
        "Permita o microfone e, para vídeo, a câmera nas configurações do navegador.",
      );
    }
  }
  async start(thread: string, video: boolean) {
    if (this.closed || this.view.busy || this.callId) return;
    const epoch = ++this.generation;
    this.change({ busy: true, error: "" });
    let stream: MediaStream | undefined;
    const id = crypto.randomUUID();
    try {
      await this.configuration();
      stream = await this.media(video);
      if (this.closed || epoch !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      await this.rpc("menchat_start_call", {
        p_id: id,
        p_thread: thread,
        p_device: this.device,
        p_video: video,
      });
      if (this.closed || epoch !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        void this.rpc("menchat_leave_call", {
          p_call: id,
          p_device: this.device,
        }).catch(() => {});
        return;
      }
      this.callId = id;
      this.cursor = 0;
      this.lastContact = Date.now();
      this.change({
        local: stream,
        mic: true,
        video,
        incoming: null,
        busy: false,
      });
      const value = await this.rpc<CallSnapshot>("menchat_call_state", {
        p_call: id,
        p_device: this.device,
        p_mic: true,
        p_video: video,
      });
      if (this.closed || epoch !== this.generation) return;
      this.change({ active: value });
      this.reconcile(value);
      void fetch("/api/calls/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      void this.rpc("menchat_leave_call", {
        p_call: id,
        p_device: this.device,
      }).catch(() => {});
      if (epoch === this.generation) {
        this.release();
        this.change({
          busy: false,
          active: null,
          local: null,
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível iniciar.",
        });
      }
    }
  }
  async accept() {
    const invitation = this.view.incoming;
    if (!invitation || this.view.busy || this.callId) return;
    const epoch = ++this.generation;
    this.change({ busy: true, error: "" });
    let stream: MediaStream | undefined;
    try {
      await this.configuration();
      stream = await this.media(invitation.video);
      if (this.closed || epoch !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      await this.rpc("menchat_join_call", {
        p_call: invitation.id,
        p_device: this.device,
      });
      if (this.closed || epoch !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        void this.rpc("menchat_leave_call", {
          p_call: invitation.id,
          p_device: this.device,
        }).catch(() => {});
        return;
      }
      this.callId = invitation.id;
      this.cursor = 0;
      this.lastContact = Date.now();
      this.change({
        local: stream,
        mic: true,
        video: invitation.video,
        incoming: null,
        busy: false,
      });
      const value = await this.rpc<CallSnapshot>("menchat_call_state", {
        p_call: invitation.id,
        p_device: this.device,
        p_mic: true,
        p_video: invitation.video,
      });
      if (this.closed || epoch !== this.generation) return;
      this.change({ active: value });
      this.reconcile(value);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      void this.rpc("menchat_leave_call", {
        p_call: invitation.id,
        p_device: this.device,
      }).catch(() => {});
      if (epoch === this.generation) {
        this.release();
        this.change({
          busy: false,
          active: null,
          local: null,
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível atender.",
        });
      }
    }
  }
  async decline() {
    const row = this.view.incoming;
    this.change({ incoming: null });
    if (row)
      await this.rpc("menchat_leave_call", {
        p_call: row.id,
        p_device: this.device,
      }).catch(() => {});
  }
  async end() {
    const id = this.callId;
    this.generation++;
    this.release();
    this.change({
      active: null,
      incoming: null,
      local: null,
      streams: new Map(),
      busy: false,
    });
    if (id)
      await this.rpc("menchat_leave_call", {
        p_call: id,
        p_device: this.device,
      }).catch(() => {});
  }
  mute() {
    const mic = !this.view.mic;
    this.view.local?.getAudioTracks().forEach((track) => {
      track.enabled = mic;
    });
    this.change({ mic });
  }
  async camera() {
    const stream = this.view.local;
    if (!this.view.active?.video || !stream) return;
    if (this.view.video) {
      stream.getVideoTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });
      this.change({ video: false, local: new MediaStream(stream.getTracks()) });
      return;
    }
    await this.acquireCamera("user");
  }
  async switchCamera() {
    const old = this.view.local?.getVideoTracks()[0];
    if (!this.view.active?.video || !this.view.video || !old) return;
    const facing =
      old.getSettings().facingMode === "environment" ? "user" : "environment";
    old.stop();
    await this.acquireCamera(facing);
  }
  private async acquireCamera(facing: string) {
    const stream = this.view.local;
    if (!stream) return;
    const epoch = this.generation;
    let acquired: MediaStream | undefined;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      if (this.closed || epoch !== this.generation) return;
      const track = acquired.getVideoTracks()[0];
      for (const peer of this.peers.values()) {
        const sender = peer.pc
          .getTransceivers()
          .find((item) => item.receiver.track.kind === "video")?.sender;
        if (sender) await sender.replaceTrack(track);
      }
      if (this.closed || epoch !== this.generation) return;
      stream.getVideoTracks().forEach((old) => {
        old.stop();
        stream.removeTrack(old);
      });
      stream.addTrack(track);
      acquired = undefined;
      this.change({ video: true, local: new MediaStream(stream.getTracks()) });
    } catch {
      if (epoch === this.generation)
        this.change({
          video: false,
          error:
            "Não foi possível ligar ou alternar a câmera. Confira a permissão do navegador.",
        });
    } finally {
      acquired?.getTracks().forEach((track) => track.stop());
    }
  }
  clearError() {
    this.change({ error: "" });
  }
  private reconcile(value: CallSnapshot) {
    const joined = value.members.filter(
      (member) =>
        member.id !== this.actor && member.state === "joined" && member.device,
    );
    for (const [id, peer] of this.peers)
      if (
        !joined.some(
          (member) => member.id === id && member.device === peer.device,
        )
      ) {
        this.closePeer(id);
      }
    for (const member of joined)
      if (!this.peers.has(member.id)) {
        this.createPeer(member);
        if (this.actor < member.id) void this.offer(member.id);
      }
  }
  private createPeer(member: CallMember) {
    const pc = new RTCPeerConnection({
      iceServers: this.config!.iceServers,
      bundlePolicy: "max-bundle",
    });
    const peer: Peer = {
      pc,
      device: member.device!,
      stream: new MediaStream(),
      negotiation: "",
      remoteNegotiation: "",
      pending: new Map(),
      offering: false,
      restarts: 0,
    };
    this.peers.set(member.id, peer);
    this.view.local
      ?.getTracks()
      .forEach((track) => pc.addTrack(track, this.view.local!));
    pc.onicecandidate = (event) => {
      if (
        this.peers.get(member.id) === peer &&
        event.candidate &&
        peer.negotiation
      )
        this.enqueue(member.id, "ice", {
          negotiation: peer.negotiation,
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
    };
    pc.ontrack = (event) => {
      if (this.peers.get(member.id) !== peer) return;
      if (!peer.stream.getTracks().some((track) => track.id === event.track.id))
        peer.stream.addTrack(event.track);
      this.change({
        streams: new Map(
          [...this.peers].map(([id, item]) => [id, item.stream]),
        ),
      });
    };
    pc.oniceconnectionstatechange = () => {
      if (peer.disconnected) clearTimeout(peer.disconnected);
      if (["disconnected", "failed"].includes(pc.iceConnectionState))
        peer.disconnected = setTimeout(() => this.restart(member.id), 4000);
      else if (["connected", "completed"].includes(pc.iceConnectionState)) {
        peer.restarts = 0;
        this.change({ error: "" });
      }
    };
  }
  private restart(id: string) {
    const peer = this.peers.get(id);
    if (!peer || peer.restarts >= 3) return;
    peer.restarts++;
    if (this.actor < id) void this.offer(id, true);
    else this.enqueue(id, "restart", {});
    this.change({ error: "Tentando reconectar a chamada…" });
  }
  private async offer(id: string, restart = false) {
    const peer = this.peers.get(id);
    if (!peer || peer.offering || this.closed || !this.callId) return;
    peer.offering = true;
    peer.negotiation = crypto.randomUUID();
    try {
      const offer = await peer.pc.createOffer({ iceRestart: restart });
      await peer.pc.setLocalDescription(offer);
      this.enqueue(id, "offer", {
        negotiation: peer.negotiation,
        sdp: peer.pc.localDescription!.sdp,
      });
    } catch {
      if (this.peers.get(id) === peer && this.callId)
        this.change({
          error: "Não foi possível negociar a conexão. Tente reconectar.",
        });
    } finally {
      peer.offering = false;
    }
  }
  private async receive(signal: Signal) {
    const peer = this.peers.get(signal.sender_id);
    if (!peer || peer.device !== signal.sender_device) return;
    const payload = signal.payload,
      negotiation = String(payload.negotiation || "");
    if (signal.kind === "restart") {
      if (this.actor < signal.sender_id)
        await this.offer(signal.sender_id, true);
      return;
    }
    if (signal.kind === "ice") {
      const candidate = {
        candidate: String(payload.candidate),
        sdpMid: typeof payload.sdpMid === "string" ? payload.sdpMid : null,
        sdpMLineIndex: Number(payload.sdpMLineIndex),
      };
      if (peer.remoteNegotiation === negotiation && peer.pc.remoteDescription)
        await peer.pc.addIceCandidate(candidate).catch(() => {});
      else {
        const queue = peer.pending.get(negotiation) || [];
        if (queue.length < 80 && peer.pending.size < 5) {
          queue.push(candidate);
          peer.pending.set(negotiation, queue);
        }
      }
      return;
    }
    if (signal.kind === "offer" && signal.sender_id < this.actor) {
      peer.negotiation = negotiation;
      await peer.pc.setRemoteDescription({
        type: "offer",
        sdp: String(payload.sdp),
      });
      peer.remoteNegotiation = negotiation;
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.enqueue(signal.sender_id, "answer", {
        negotiation,
        sdp: peer.pc.localDescription!.sdp,
      });
    } else if (
      signal.kind === "answer" &&
      negotiation === peer.negotiation &&
      peer.pc.signalingState === "have-local-offer"
    ) {
      await peer.pc.setRemoteDescription({
        type: "answer",
        sdp: String(payload.sdp),
      });
      peer.remoteNegotiation = negotiation;
    }
    for (const candidate of peer.pending.get(peer.remoteNegotiation) || [])
      await peer.pc.addIceCandidate(candidate).catch(() => {});
    peer.pending.delete(peer.remoteNegotiation);
  }
  private enqueue(to: string, kind: string, payload: Record<string, unknown>) {
    const peer = this.peers.get(to);
    if (!peer || !this.callId || this.closed) return;
    if (this.outgoing.length >= 256) {
      this.change({ error: "A conexão está congestionada. Tente reconectar." });
      return;
    }
    this.outgoing.push({
      id: crypto.randomUUID(),
      to,
      device: peer.device,
      kind,
      payload,
    });
    void this.flush();
  }
  private async flush() {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.outgoing.length && this.callId && !this.closed) {
        const row = this.outgoing[0],
          id = this.callId,
          epoch = this.generation;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await this.rpc("menchat_call_signal", {
              p_call: id,
              p_device: this.device,
              p_to: row.to,
              p_to_device: row.device,
              p_id: row.id,
              p_kind: row.kind,
              p_payload: row.payload,
            });
            break;
          } catch {
            if (attempt === 2)
              this.change({
                error: "Sinalização interrompida. Tentando reconectar…",
              });
            else
              await new Promise((resolve) =>
                setTimeout(resolve, 300 * (attempt + 1)),
              );
          }
          if (epoch !== this.generation || this.closed) break;
        }
        if (this.outgoing[0] === row) this.outgoing.shift();
      }
    } finally {
      this.sending = false;
    }
  }
  private closePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    if (peer.disconnected) clearTimeout(peer.disconnected);
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.oniceconnectionstatechange = null;
    peer.pc.close();
    this.peers.delete(id);
    this.change({
      streams: new Map(
        [...this.peers].map(([key, item]) => [key, item.stream]),
      ),
    });
  }
  private release() {
    this.callId = null;
    this.outgoing = [];
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.view.local?.getTracks().forEach((track) => track.stop());
    this.cursor = 0;
  }
  destroy() {
    const id = this.callId;
    this.closed = true;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.release();
    if (id)
      void this.rpc("menchat_leave_call", {
        p_call: id,
        p_device: this.device,
      }).catch(() => {});
  }
}
