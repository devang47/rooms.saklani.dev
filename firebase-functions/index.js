const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

initializeApp();

const ROOM_TTL_MS = 15 * 60 * 1000;

// Rules already block expired rooms; this just frees the storage.
// ponytail: scans every room doc each run; switch to a `createdAt <` query once legacy
// docs (which only have `timestamp`) are gone and room counts grow.
exports.deleteExpiredRooms = onSchedule("every 5 minutes", async () => {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const cutoff = Date.now() - ROOM_TTL_MS;

  const rooms = await db.collection("rooms").get();
  const expired = rooms.docs.filter((doc) => {
    const createdAt =
      doc.get("createdAt")?.toMillis() ?? doc.get("timestamp") ?? 0;
    return createdAt < cutoff;
  });

  const results = await Promise.allSettled(
    expired.map(async (doc) => {
      await bucket.deleteFiles({ prefix: `${doc.id}/` });
      await db.recursiveDelete(doc.ref);
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => logger.error("Room cleanup failed", r.reason));
  logger.info(
    `Deleted ${expired.length - failed.length}/${expired.length} expired rooms`,
  );
});
