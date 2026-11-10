const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

initializeApp();

// Keep in sync with roomTtlMs() in firestore.rules.
const ROOM_TTL_MS = 15 * 60 * 1000;

async function cleanup(db, bucket, now = Date.now()) {
  const cutoff = now - ROOM_TTL_MS;

  const rooms = await db
    .collection("rooms")
    .where("timestamp", "<", cutoff)
    .get();

  // Rooms live for 15 minutes, so any older file belongs to an expired room.
  // This also catches files left behind after their room doc was deleted.
  const [files] = await bucket.getFiles();
  const expiredFiles = files.filter(
    (file) => new Date(file.metadata.timeCreated).getTime() < cutoff,
  );

  const results = await Promise.allSettled([
    ...rooms.docs.map((room) => db.recursiveDelete(room.ref)),
    ...expiredFiles.map((file) => file.delete({ ignoreNotFound: true })),
  ]);

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `Cleanup failed for ${failures.length} of ${results.length} items`,
    );
  }

  return { rooms: rooms.size, files: expiredFiles.length };
}

exports.cleanup = cleanup;

exports.cleanupExpiredRooms = onSchedule("every 1 minutes", async () => {
  await cleanup(getFirestore(), getStorage().bucket());
});
