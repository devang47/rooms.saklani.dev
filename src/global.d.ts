interface Message {
  data: string;
  timestamp: string;
  device: string;
}

interface RelayMessage extends Message {
  deviceId: string;
  // Set when the message is a file card.
  fileId?: string;
}

interface Transfer {
  id: string;
  peer: string;
  name: string;
  size: number;
  outgoing: boolean;
  state:
    | "waiting"
    | "offered"
    | "transferring"
    | "done"
    | "declined"
    | "failed";
  progress: number;
  url?: string;
}

interface Prompt {
  id: number;
  text: string;
  accept: string;
  decline: string;
  answer: (accepted: boolean) => void;
}

interface CustomNotification {
  data: string;
  error: boolean;
}
