interface Message {
  id?: string;
  data: string;
  timestamp: string | number;
  device: string;
  deviceId?: string;
  /** Room messages only: sent from this browser. */
  mine?: boolean;
  /** P2P file messages: a local object URL to download from. */
  file?: { name: string; size: number; url: string };
}

interface RelayMessage extends Message {
  deviceId: string;
}

interface CustomNotification {
  id: number;
  data: string;
  error: boolean;
}
