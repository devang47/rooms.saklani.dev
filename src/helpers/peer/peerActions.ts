import { PeerConnection } from ".";
import { addNotification } from "#utils/notifications.ts";
import {
  connectionListLoading,
  handleReceiveData,
  startPeerSession,
} from "./actions";
import { addConnectionList, removeConnectionList } from "./actions";
import { failTransfers } from "./files";

export const startPeer = async () => {
  let timeout: NodeJS.Timeout | null = null;
  try {
    timeout = setTimeout(() => {
      addNotification(
        "The server is taking some time to start. Please wait...",
        false,
        4000,
      );
    }, 5000);

    connectionListLoading(true);

    const id = await PeerConnection.startPeerSession();

    clearTimeout(timeout);
    timeout = null;

    PeerConnection.onIncomingConnection((conn) => {
      const peerId = conn.peer;
      addConnectionList(peerId);

      PeerConnection.onConnectionDisconnected(peerId, () => {
        addNotification("Connection closed: " + peerId);
        failTransfers(peerId);
        removeConnectionList(peerId);
      });
      PeerConnection.onConnectionReceiveData(peerId, (data) => {
        handleReceiveData(data, peerId);
      });
    });

    startPeerSession(id);
  } catch (err: any) {
    console.log(err);
    addNotification(err.message, true);
    connectionListLoading(false);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  connectionListLoading(false);
};
