import type {
  default as Peer,
  DataConnection,
  MediaConnection,
  PeerErrorType,
  PeerError,
} from "peerjs";
import { addNotification } from "#utils/notifications.ts";
import { ask } from "#utils/prompts.ts";
import { get } from "svelte/store";
import {
  connectionState,
  currentUserVideoRef,
  relayMessages,
  remoteUserVideoRef,
  videoCallDialogOpen,
} from "#stores";

const activeConnectionsMap = new Map<string, DataConnection>();

export enum DataType {
  MESSAGE = "MESSAGE",
  SYSTEM = "SYSTEM",
  FILE_OFFER = "FILE_OFFER",
  FILE_ACCEPT = "FILE_ACCEPT",
  FILE_DECLINE = "FILE_DECLINE",
  FILE_CHUNK = "FILE_CHUNK",
}

export interface Data {
  dataType: DataType;
  timestamp: string;
  deviceId: string;
  message?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  chunk?: ArrayBuffer;
  last?: boolean;
}

const host = import.meta.env.VITE_PEERJS_HOST;
// A local signalling server (tests, development) runs without TLS.
const secure = !/^(localhost|127\.0\.0\.1)$/.test(host);

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

let peer: Peer | undefined;
let call: MediaConnection | undefined;
let mediaStream: MediaStream | undefined;

const showStreams = (local: MediaStream, connection: MediaConnection) => {
  get(currentUserVideoRef).srcObject = local;
  connection.on("stream", (remoteStream) => {
    get(remoteUserVideoRef).srcObject = remoteStream;
    videoCallDialogOpen.set(true);
  });
  connection.on("close", () => {
    addNotification("Call closed", false);
    closeCall();
  });
};

export const PeerConnection = {
  getPeer: () => peer,
  getConnection: (id: string) => activeConnectionsMap.get(id),
  startPeerSession: async () => {
    const [{ default: PeerClient }, { generateRandomName }] = await Promise.all(
      [import("peerjs"), import("#utils/index.ts")],
    );

    return new Promise<string>((resolve, reject) => {
      try {
        peer = new PeerClient(generateRandomName(), {
          host,
          port: Number(import.meta.env.VITE_PEERJS_PORT),
          secure,
        });

        peer.on("open", resolve);

        peer.on("call", async (incoming) => {
          // Only peers the user already accepted can ring them.
          if (!activeConnectionsMap.has(incoming.peer)) {
            incoming.close();
            return;
          }

          const accepted = await ask(`${incoming.peer} is calling`, {
            accept: "Answer",
          });
          if (!accepted) {
            incoming.close();
            sendSystemMessage("Call declined");
            return;
          }

          try {
            mediaStream = await navigator.mediaDevices.getUserMedia(MEDIA);
            // Kept so that hanging up here also ends the call.
            call = incoming;
            incoming.answer(mediaStream);
            showStreams(mediaStream, incoming);
          } catch (error) {
            console.log(error);
            addNotification("Error when trying to call peer", true);
          }
        });

        peer.on("error", (err) => {
          console.log(err);
          addNotification(err.message, true);
        });
      } catch (err) {
        console.log(err);
        reject(err);
      }
    });
  },
  closePeerSession: async () => {
    peer?.destroy();
    peer = undefined;
    activeConnectionsMap.clear();
  },
  connectPeer: (id: string) =>
    new Promise<void>((resolve, reject) => {
      if (!peer) {
        reject(new Error("Peer hasn't started yet"));
        return;
      }
      if (activeConnectionsMap.has(id)) {
        reject(new Error("Connection existed"));
        return;
      }
      try {
        let conn = peer.connect(id, { reliable: true });
        if (!conn) {
          reject(new Error("Connection can't be established"));
        } else {
          conn
            .on("open", function () {
              activeConnectionsMap.set(id, conn);
              peer?.removeListener("error", handlePeerError);
              resolve();
            })
            .on("error", function (err) {
              console.log(err);
              peer?.removeListener("error", handlePeerError);
              reject(err);
            });

          // When the connection fails due to expiry, the error gets emmitted
          // to the peer instead of to the connection.
          // We need to handle this here to be able to fulfill the Promise.
          const handlePeerError = (err: PeerError<`${PeerErrorType}`>) => {
            if (err.type === "peer-unavailable") {
              const messageSplit = err.message.split(" ");
              const peerId = messageSplit[messageSplit.length - 1];
              if (id === peerId) reject(err);
            }
          };
          peer.on("error", handlePeerError);
        }
      } catch (err) {
        reject(err);
      }
    }),
  onIncomingConnection: (callback: (conn: DataConnection) => void) => {
    peer?.on("connection", async (conn) => {
      // A declined peer is never registered, so nothing it sends gets handled.
      const accepted = await ask(`${conn.peer} wants to connect`);
      if (!accepted || !peer) {
        conn.close();
        return;
      }

      activeConnectionsMap.set(conn.peer, conn);
      callback(conn);
    });
  },
  onConnectionDisconnected: (id: string, callback: () => void) => {
    activeConnectionsMap.get(id)?.on("close", () => {
      activeConnectionsMap.delete(id);
      callback();
    });
  },
  sendConnection: async (id: string, data: Data) => {
    const conn = activeConnectionsMap.get(id);
    if (!conn) throw new Error("Connection didn't exist");
    await conn.send(data);
  },
  onConnectionReceiveData: (id: string, callback: (data: Data) => void) => {
    activeConnectionsMap
      .get(id)
      ?.on("data", (receivedData) => callback(receivedData as Data));
  },

  callPeer: async (remotePeerId: string) => {
    if (!peer) {
      throw new Error("Peer hasn't started yet");
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(MEDIA);
      call = peer.call(remotePeerId, mediaStream);
      sendSystemMessage("Call started by " + get(connectionState).id);
      showStreams(mediaStream, call);
    } catch (err) {
      console.log(err);
      addNotification("Error when trying to call peer", true);
    }
  },
};

export const closeCall = () => {
  call?.close();
  call = undefined;

  videoCallDialogOpen.set(false);
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = undefined;

  get(currentUserVideoRef).srcObject = null;
  get(remoteUserVideoRef).srcObject = null;
};

// Turns the microphone or camera on or off, and returns whether it is now on.
export const toggleTrack = (kind: "audio" | "video") => {
  const tracks =
    kind === "audio"
      ? mediaStream?.getAudioTracks()
      : mediaStream?.getVideoTracks();
  tracks?.forEach((track) => (track.enabled = !track.enabled));
  return tracks?.[0]?.enabled ?? true;
};

export const sendSystemMessage = async (message: string) => {
  const selectedId = get(connectionState).selectedId;
  if (!selectedId) return;

  const data = {
    dataType: DataType.SYSTEM,
    message,
    deviceId: get(connectionState).id ?? "",
    timestamp: new Date().toString(),
  };

  await PeerConnection.sendConnection(selectedId, data);
  relayMessages.update((msgs) => {
    msgs.set(selectedId, [
      ...(msgs.get(selectedId) ?? []),
      {
        data: data.message,
        device: data.deviceId,
        deviceId: data.deviceId,
        timestamp: data.timestamp,
      },
    ]);

    return msgs;
  });
};
