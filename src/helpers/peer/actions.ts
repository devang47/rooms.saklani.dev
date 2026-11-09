import { connectionState, initialState, loading, relayMessages } from "#stores";
import { addNotification } from "#utils/notifications.ts";
import { closeCall, DataType, PeerConnection, type Data } from ".";
import { failTransfers, handleFileData } from "./files";

export const startPeerSession = (id: string) => {
  connectionState.update((state) => {
    return { ...state, id: id, started: true };
  });
};

export const stopPeerSession = () => {
  connectionState.set(initialState);
};

export const connectionListLoading = (loading: boolean) => {
  connectionState.update((state) => {
    return { ...state, loading };
  });
};

export const removeConnectionList = (id: string) => {
  connectionState.update((state) => {
    let newList = state.list.filter((item) => item !== id);
    if (state.selectedId === id) {
      if (newList.length === 0) {
        return { ...state, list: newList, selectedId: undefined };
      } else {
        return { ...state, list: newList, selectedId: newList[0] };
      }
    }
    return { ...state, list: newList };
  });
};

export const addConnectionList = (id: string) => {
  connectionState.update((state) => {
    let newList = [...state.list, id];

    if (newList.length === 1) {
      return { ...state, list: newList, selectedId: id };
    }

    return { ...state, list: [...state.list, id] };
  });
};

export const selectConnection = (id: string) => {
  connectionState.update((state) => {
    return { ...state, selectedId: id };
  });
};

export const connectPeer = async (id: string) => {
  try {
    await PeerConnection.connectPeer(id);
    PeerConnection.onConnectionDisconnected(id, () => {
      addNotification("Connection closed: " + id, false);
      failTransfers(id);
      removeConnectionList(id);
    });
    PeerConnection.onConnectionReceiveData(id, (data) => {
      handleReceiveData(data, id);
    });
    addConnectionList(id);
  } catch (err: any) {
    addNotification(err.message, true);
  }
  loading.set(false);
};

export const handleReceiveData = (data: Data, id: string) => {
  if (handleFileData(data, id)) return;

  if (data.dataType === DataType.MESSAGE || data.dataType === DataType.SYSTEM) {
    if (data.dataType === DataType.SYSTEM) {
      switch (data.message) {
        case "Call declined":
        case "Call ended":
          addNotification("Call closed by " + id, false);
          closeCall();
          break;
        default:
      }
    }

    // Trust the connection's ID, not the sender-supplied deviceId, so a peer
    // can't write into another conversation.
    relayMessages.update((msgs) => {
      msgs.set(id, [
        ...(msgs.get(id) ?? []),
        {
          data: data.message ?? "",
          deviceId: id,
          timestamp: data.timestamp,
          device: id,
        },
      ]);

      return msgs;
    });
  }
};
