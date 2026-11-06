import Peer, { type DataConnection, type MediaConnection } from "peerjs";
import { get } from "svelte/store";
import {
  connectionState,
  initialState,
  relayMessages,
  currentUserVideoRef,
  remoteUserVideoRef,
  videoCallDialogOpen,
} from "#lib/stores/index.ts";
import { addNotification } from "#lib/utils/notifications.ts";
import { askConfirm } from "#lib/utils/confirm.ts";
import { generateRandomName } from "#lib/utils/index.ts";

export const MAX_P2P_FILE_SIZE = 100 * 1024 * 1024; // whole file is held in memory on both ends
const CONNECT_TIMEOUT_MS = 60_000; // the other side has to click "Accept"

const MEDIA: MediaStreamConstraints = {
  video: {
    width: { ideal: 340 },
    height: { ideal: 340 },
    frameRate: { ideal: 24 },
    aspectRatio: 1,
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

/** Wire protocol between two tabs of this app. */
type Packet =
  | { type: "accept" }
  | { type: "decline" }
  | { type: "message"; text: string; timestamp: number }
  | {
      type: "file";
      file: ArrayBuffer;
      name: string;
      mime: string;
      timestamp: number;
    }
  | { type: "call-declined" }
  | { type: "call-ended" };

let peer: Peer | undefined;
const connections = new Map<string, DataConnection>();
let call: MediaConnection | undefined;
let localStream: MediaStream | undefined;
const objectUrls: string[] = [];

const myId = () => get(connectionState).id ?? "";

const pushMessage = (peerId: string, msg: RelayMessage) =>
  relayMessages.update((all) =>
    all.set(peerId, [...(all.get(peerId) ?? []), msg]),
  );

const fileUrl = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
};

const send = (peerId: string, packet: Packet) => {
  const conn = connections.get(peerId);
  if (!conn?.open) throw new Error(`Not connected to ${peerId}`);
  conn.send(packet);
};

const trySend = (peerId: string, packet: Packet) => {
  try {
    send(peerId, packet);
  } catch {
    // peer already gone: nothing to tell it
  }
};

// ---------------------------------------------------------------- session

export const startPeer = async () => {
  if (peer) return;
  connectionState.update((s) => ({ ...s, loading: true }));
  const slowStart = setTimeout(
    () =>
      addNotification(
        "The server is taking some time to start. Please wait...",
        false,
        4000,
      ),
    5000,
  );

  try {
    const p = new Peer(generateRandomName(), {
      // Falls back to the public PeerJS cloud server when unset (handy for local dev).
      host: import.meta.env.VITE_PEERJS_HOST || undefined,
      port: Number(import.meta.env.VITE_PEERJS_PORT) || 443,
      secure: import.meta.env.VITE_PEERJS_SECURE !== "false", // local peer server is plain http
    });
    peer = p;

    const id = await new Promise<string>((resolve, reject) => {
      p.once("open", resolve);
      p.once("error", reject); // e.g. server down or ID taken, before we're online
    });

    p.on("connection", handleIncomingConnection);
    p.on("call", handleIncomingCall);
    p.on("disconnected", () => {
      // Signaling socket dropped (sleep, network change). Open chats keep working; reconnect for new ones.
      if (peer === p && !p.destroyed) p.reconnect();
    });
    p.on("error", (err) => {
      // peer-unavailable is reported by connectPeer itself.
      if (err.type !== "peer-unavailable") addNotification(err.message, true);
    });

    connectionState.update((s) => ({ ...s, id, started: true }));
  } catch (err: any) {
    peer?.destroy();
    peer = undefined;
    addNotification(err?.message || "Couldn't start the server", true);
  } finally {
    clearTimeout(slowStart);
    connectionState.update((s) => ({ ...s, loading: false }));
  }
};

export const stopPeer = () => {
  endCall();
  connections.clear(); // before destroy(), so their close handlers stay quiet
  peer?.destroy();
  peer = undefined;
  objectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  relayMessages.set(new Map());
  connectionState.set(initialState);
};

// ---------------------------------------------------------------- connections

/** Wires up an accepted connection and adds it to the list. */
const register = (conn: DataConnection) => {
  const peerId = conn.peer;
  // A reconnect from the same peer replaces the old connection (set first so its close is ignored).
  const previous = connections.get(peerId);
  connections.set(peerId, conn);
  previous?.close();

  conn.on("data", (data) => handlePacket(peerId, data as Packet));
  conn.on("close", () => {
    if (connections.get(peerId) !== conn) return; // replaced, or we stopped
    connections.delete(peerId);
    if (call?.peer === peerId) endCall(false);
    addNotification("Connection closed: " + peerId);
    connectionState.update((s) => {
      const list = s.list.filter((id) => id !== peerId);
      return {
        ...s,
        list,
        selectedId: s.selectedId === peerId ? list[0] : s.selectedId,
      };
    });
  });

  connectionState.update((s) => ({
    ...s,
    list: s.list.includes(peerId) ? s.list : [...s.list, peerId],
    selectedId: s.selectedId ?? peerId,
  }));
};

const handleIncomingConnection = async (conn: DataConnection) => {
  const accepted = await askConfirm(
    `${conn.peer} wants to connect`,
    "Accept",
    "Decline",
  );
  if (!peer) return conn.close();

  // Wait for the channel so the answer actually reaches the other side.
  const reply = () => {
    if (!accepted) {
      conn.send({ type: "decline" } satisfies Packet);
      setTimeout(() => conn.close(), 500);
      return;
    }
    register(conn);
    conn.send({ type: "accept" } satisfies Packet);
    addNotification("Connected to " + conn.peer);
  };
  conn.open ? reply() : conn.once("open", reply);
};

/** Connects to `rawId` and resolves once they accept. */
export const connectPeer = (rawId: string) =>
  new Promise<void>((resolve, reject) => {
    const id = rawId.trim().toLowerCase();
    if (!peer) return reject(new Error("Start the server first"));
    if (!id) return reject(new Error("Please enter a valid ID"));
    if (id === myId()) return reject(new Error("Cannot connect to self"));
    if (connections.has(id)) {
      selectConnection(id);
      return resolve();
    }

    const p = peer;
    const conn = p.connect(id, { reliable: true });
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      p.off("error", onPeerError);
      if (err) {
        conn.close();
        reject(err);
      } else resolve();
    };

    const timer = setTimeout(
      () => finish(new Error(`No response from ${id}`)),
      CONNECT_TIMEOUT_MS,
    );
    // An unknown ID is reported on the peer, not the connection.
    const onPeerError = (err: { type: string; message: string }) => {
      if (err.type === "peer-unavailable" && err.message.endsWith(id))
        finish(new Error(`${id} is not online`));
    };
    p.on("error", onPeerError);

    conn.on("data", (data) => {
      if (settled) return;
      const packet = data as Packet;
      if (packet?.type === "accept") {
        register(conn);
        finish();
      } else if (packet?.type === "decline") {
        finish(new Error(`${id} declined the connection`));
      }
    });
    conn.on("close", () => finish(new Error(`Couldn't connect to ${id}`)));
    conn.on("error", (err) => finish(err));
  });

export const selectConnection = (id: string) =>
  connectionState.update((s) => ({ ...s, selectedId: id }));

// ---------------------------------------------------------------- messages & files

const handlePacket = (peerId: string, packet: Packet) => {
  switch (packet?.type) {
    case "message":
      pushMessage(peerId, {
        data: packet.text,
        timestamp: packet.timestamp,
        device: peerId,
        deviceId: peerId,
      });
      break;
    case "file": {
      const blob = new Blob([packet.file], { type: packet.mime });
      pushMessage(peerId, {
        data: packet.name,
        file: { name: packet.name, size: blob.size, url: fileUrl(blob) },
        timestamp: packet.timestamp,
        device: peerId,
        deviceId: peerId,
      });
      addNotification(`${peerId} sent you ${packet.name}`);
      break;
    }
    case "call-declined":
    case "call-ended":
      if (call?.peer === peerId) {
        endCall(false);
        addNotification(
          packet.type === "call-declined"
            ? `${peerId} declined the call`
            : "Call ended",
        );
      }
      break;
  }
};

export const sendMessage = (peerId: string, text: string) => {
  const timestamp = Date.now();
  send(peerId, { type: "message", text, timestamp });
  pushMessage(peerId, {
    data: text,
    timestamp,
    device: myId(),
    deviceId: myId(),
  });
};

export const sendFile = async (peerId: string, file: File) => {
  if (file.size > MAX_P2P_FILE_SIZE)
    throw new Error("Files over 100 MB can't be sent");
  const timestamp = Date.now();
  send(peerId, {
    type: "file",
    file: await file.arrayBuffer(),
    name: file.name,
    mime: file.type,
    timestamp,
  });
  pushMessage(peerId, {
    data: file.name,
    file: { name: file.name, size: file.size, url: fileUrl(file) },
    timestamp,
    device: myId(),
    deviceId: myId(),
  });
};

// ---------------------------------------------------------------- video calls

const getMedia = () => navigator.mediaDevices.getUserMedia(MEDIA); // must be called as a method

const showCall = () => {
  const local = get(currentUserVideoRef);
  if (local) local.srcObject = localStream ?? null;
  videoCallDialogOpen.set(true);
};

const attachCall = (c: MediaConnection) => {
  call = c;
  c.on("stream", (remote) => {
    const video = get(remoteUserVideoRef);
    if (video) video.srcObject = remote;
  });
  c.on("close", () => {
    if (call === c) endCall(false);
  });
};

export const startCall = async (peerId: string) => {
  if (!peer || call) return;
  try {
    localStream = await getMedia();
  } catch {
    addNotification("Allow camera and microphone access to make a call", true);
    return;
  }
  attachCall(peer.call(peerId, localStream));
  showCall();
};

const handleIncomingCall = async (c: MediaConnection) => {
  // Only peers you already accepted can ring you, one call at a time.
  if (!connections.has(c.peer) || call) {
    trySend(c.peer, { type: "call-declined" });
    return c.close();
  }

  const accepted = await askConfirm(
    `${c.peer} is calling you`,
    "Accept",
    "Decline",
  );
  if (accepted) {
    try {
      localStream = await getMedia();
    } catch {
      addNotification("Allow camera and microphone access to answer", true);
    }
  }
  if (!accepted || !localStream || !peer) {
    trySend(c.peer, { type: "call-declined" });
    return c.close();
  }

  attachCall(c);
  c.answer(localStream);
  showCall();
};

/** Hangs up and releases the camera. `notifyPeer` is false when the other side ended it. */
export const endCall = (notifyPeer = true) => {
  const c = call;
  call = undefined; // first, so the close event below doesn't re-enter
  if (c && notifyPeer) trySend(c.peer, { type: "call-ended" });
  c?.close();

  localStream?.getTracks().forEach((track) => track.stop());
  localStream = undefined;
  videoCallDialogOpen.set(false);
  for (const video of [get(currentUserVideoRef), get(remoteUserVideoRef)]) {
    if (video) video.srcObject = null;
  }
};
