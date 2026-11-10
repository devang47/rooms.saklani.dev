import { get } from "svelte/store";
import { connectionState, relayMessages, transfers } from "#stores";
import { DataType, PeerConnection, type Data } from "./index";

const CHUNK_SIZE = 64 * 1024;
// Stops queueing chunks while this much is still waiting to go out, so the
// progress shown matches what has really been sent.
const MAX_BUFFERED = 1024 * 1024;

// ponytail: received files are kept in memory until saved, which is fine up to
// a few hundred MB. Stream to disk with the File System Access API beyond that.
const outgoing = new Map<string, File>();
const incoming = new Map<string, { chunks: ArrayBuffer[]; received: number }>();

const update = (id: string, change: Partial<Transfer>) =>
  transfers.update((all) => ({
    ...all,
    [id]: { ...all[id], ...change } as Transfer,
  }));

const addCard = (peerId: string, fileId: string, from: string) =>
  relayMessages.update((msgs) => {
    msgs.set(peerId, [
      ...(msgs.get(peerId) ?? []),
      {
        data: "",
        device: from,
        deviceId: from,
        timestamp: new Date().toString(),
        fileId,
      },
    ]);
    return msgs;
  });

const control = (type: DataType, fileId: string): Data => ({
  dataType: type,
  fileId,
  deviceId: get(connectionState).id ?? "",
  timestamp: String(Date.now()),
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const save = (url: string, name: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
};

export const offerFile = async (peerId: string, file: File) => {
  const fileId = crypto.randomUUID();
  const me = get(connectionState).id ?? "";
  outgoing.set(fileId, file);
  update(fileId, {
    id: fileId,
    peer: peerId,
    name: file.name,
    size: file.size,
    outgoing: true,
    state: "waiting",
    progress: 0,
  });
  addCard(peerId, fileId, me);
  await PeerConnection.sendConnection(peerId, {
    ...control(DataType.FILE_OFFER, fileId),
    fileName: file.name,
    fileSize: file.size,
  });
};

export const answerFile = async (fileId: string, accepted: boolean) => {
  const transfer = get(transfers)[fileId];
  if (!transfer || transfer.state !== "offered") return;
  if (accepted) incoming.set(fileId, { chunks: [], received: 0 });
  update(fileId, { state: accepted ? "transferring" : "declined" });
  await PeerConnection.sendConnection(
    transfer.peer,
    control(accepted ? DataType.FILE_ACCEPT : DataType.FILE_DECLINE, fileId),
  );
};

const send = async (peerId: string, fileId: string) => {
  const file = outgoing.get(fileId);
  const conn = PeerConnection.getConnection(peerId);
  if (!file || !conn) return;
  outgoing.delete(fileId);
  update(fileId, { state: "transferring" });

  // bufferSize is PeerJS's own queue, on the binary connection it uses.
  const backedUp = () =>
    ((conn as { bufferSize?: number }).bufferSize ?? 0) > 0 ||
    (conn.dataChannel?.bufferedAmount ?? 0) > MAX_BUFFERED;

  try {
    for (let offset = 0; ; offset += CHUNK_SIZE) {
      while (conn.open && backedUp()) await wait(20);
      if (!conn.open) throw new Error("Connection closed");

      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const last = end >= file.size;
      await conn.send({
        ...control(DataType.FILE_CHUNK, fileId),
        chunk: await file.slice(offset, end).arrayBuffer(),
        last,
      });
      update(fileId, { progress: file.size ? end / file.size : 1 });
      if (last) break;
    }
    update(fileId, { state: "done", progress: 1 });
  } catch {
    update(fileId, { state: "failed" });
  }
};

const receive = (fileId: string, data: Data) => {
  const transfer = get(transfers)[fileId];
  const pending = incoming.get(fileId);
  if (!transfer || !pending || !data.chunk) return;

  pending.chunks.push(data.chunk);
  pending.received += data.chunk.byteLength;
  update(fileId, {
    progress: transfer.size ? Math.min(1, pending.received / transfer.size) : 1,
  });
  if (!data.last) return;

  incoming.delete(fileId);
  // Saved as plain bytes: a blob URL typed as HTML, opened in a new tab, would
  // run in this site's origin.
  const url = URL.createObjectURL(
    new Blob(pending.chunks, { type: "application/octet-stream" }),
  );
  update(fileId, { state: "done", progress: 1, url });
  save(url, transfer.name);
};

// Handles file messages from a connected peer. Returns false for anything else.
export const handleFileData = (data: Data, peerId: string) => {
  const fileId = data.fileId ?? "";
  const transfer = get(transfers)[fileId];
  // A peer may only act on transfers it is part of.
  const ours = transfer?.peer === peerId;

  switch (data.dataType) {
    case DataType.FILE_OFFER:
      if (transfer) return true;
      update(fileId, {
        id: fileId,
        peer: peerId,
        name: data.fileName || "file",
        size: Math.max(0, Number(data.fileSize) || 0),
        outgoing: false,
        state: "offered",
        progress: 0,
      });
      addCard(peerId, fileId, peerId);
      return true;
    case DataType.FILE_ACCEPT:
      if (ours && transfer.outgoing && transfer.state === "waiting") {
        send(peerId, fileId);
      }
      return true;
    case DataType.FILE_DECLINE:
      if (ours && transfer.outgoing && transfer.state === "waiting") {
        outgoing.delete(fileId);
        update(fileId, { state: "declined" });
      }
      return true;
    case DataType.FILE_CHUNK:
      if (ours && !transfer.outgoing) receive(fileId, data);
      return true;
    default:
      return false;
  }
};

// Marks unfinished transfers with a peer as failed once it disconnects.
export const failTransfers = (peerId: string) => {
  for (const transfer of Object.values(get(transfers))) {
    if (
      transfer.peer === peerId &&
      ["waiting", "offered", "transferring"].includes(transfer.state)
    ) {
      outgoing.delete(transfer.id);
      incoming.delete(transfer.id);
      update(transfer.id, { state: "failed" });
    }
  }
};
