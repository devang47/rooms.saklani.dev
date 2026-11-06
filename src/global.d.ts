interface Message {
  id?: string;
  data: string;
  timestamp: string | number;
  device: string;
  deviceId?: string;
  /** Room messages only: sent from this browser. */
  mine?: boolean;
}

interface RelayMessage extends Message {
  deviceId: string;
}

interface CustomNotification {
  data: string;
  error: boolean;
}
