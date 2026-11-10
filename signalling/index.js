// A PeerJS-compatible signalling server on Cloudflare Workers.
//
// It only introduces peers: offers, answers and network candidates pass through
// it, then messages, files and calls flow directly between browsers.
import { DurableObject } from "cloudflare:workers";

// Must match exactly what the PeerJS client sends every 5 seconds.
const HEARTBEAT = '{"type":"HEARTBEAT"}';
const RELAYED = new Set(["OFFER", "ANSWER", "CANDIDATE", "LEAVE"]);
const VALID_ID = /^[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*$/;
const MAX_MESSAGE = 64 * 1024;
// PeerJS sends a heartbeat every 5s; a peer silent for this long is gone.
const STALE_MS = 60_000;

const isAllowed = (origin, allowed) => {
  if (!allowed) return true;
  return allowed.split(",").some((entry) => {
    entry = entry.trim();
    if (entry.startsWith("https://*.")) {
      return (
        !!origin &&
        origin.startsWith("https://") &&
        origin.endsWith(entry.slice("https://*".length))
      );
    }
    return entry === origin;
  });
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/")
      return Response.json({ name: "ChatRooms signalling" });
    if (pathname !== "/peerjs")
      return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    // Stops other websites from using this server through their visitors.
    if (!isAllowed(request.headers.get("Origin"), env.ALLOWED_ORIGINS)) {
      return new Response("Forbidden", { status: 403 });
    }
    // ponytail: one object holds every socket, which is plenty for this app.
    // Shard by peer ID if it ever needs more than a few thousand at once.
    return env.SIGNAL.get(env.SIGNAL.idFromName("global")).fetch(request);
  },
};

export class Signal extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Cloudflare answers heartbeats itself, so the object can sleep between
    // real messages and idle peers cost nothing.
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(HEARTBEAT, HEARTBEAT),
    );
  }

  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const id = params.get("id") ?? "";
    const token = params.get("token") ?? "";
    const [client, server] = Object.values(new WebSocketPair());

    const reject = (type, msg) => {
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type, payload: { msg } }));
      server.close(1008, msg);
      return new Response(null, { status: 101, webSocket: client });
    };

    if (params.get("key") !== "peerjs")
      return reject("INVALID-KEY", "Invalid key");
    if (id.length > 64 || !VALID_ID.test(id) || !token) {
      return reject("ERROR", "Invalid ID or token");
    }

    const existing = this.peer(id);
    if (existing) {
      if (existing.deserializeAttachment().token !== token) {
        return reject("ID-TAKEN", "ID is taken");
      }
      // The same browser reconnecting replaces its old socket.
      existing.close(1000, "Replaced by a new connection");
    }

    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, token, since: Date.now() });
    server.send(JSON.stringify({ type: "OPEN" }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return;
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!RELAYED.has(message.type) || typeof message.dst !== "string") return;

    const { id } = ws.deserializeAttachment();
    const target = this.peer(message.dst);
    if (target) {
      // The server sets the sender, so a peer can't pretend to be someone else.
      target.send(
        JSON.stringify({
          type: message.type,
          src: id,
          dst: message.dst,
          payload: message.payload,
        }),
      );
    } else if (message.type === "OFFER") {
      // Tells the caller straight away that nobody has that ID.
      ws.send(JSON.stringify({ type: "EXPIRE", src: message.dst, dst: id }));
    }
  }

  // The open, live socket for a peer ID, if any.
  peer(id) {
    for (const ws of this.ctx.getWebSockets(id)) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const lastHeartbeat = this.ctx.getWebSocketAutoResponseTimestamp(ws);
      const lastSeen = Math.max(
        lastHeartbeat?.getTime() ?? 0,
        ws.deserializeAttachment().since,
      );
      if (Date.now() - lastSeen > STALE_MS) {
        ws.close(1001, "No heartbeat");
        continue;
      }
      return ws;
    }
  }
}
