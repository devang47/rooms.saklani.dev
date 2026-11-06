import { writable } from "svelte/store";

export const roomMessages = writable<any>([]);
// Off by default so prerendered pages paint immediately; pages that load data turn it on.
export const loading = writable<boolean>(false);
/** Upload progress in percent while a file uploads, otherwise null. */
export const uploadProgress = writable<number | null>(null);
export const notifications = writable<CustomNotification[]>([]);
export const roomData = writable<any>(false);

export interface ConnectionState {
  readonly id?: string;
  readonly started: boolean;
  readonly loading: boolean;
  /** Accepted peers. */
  readonly list: string[];
  readonly selectedId?: string;
}

export const initialState: ConnectionState = {
  loading: false,
  list: [],
  started: false,
};

export const connectionState = writable<ConnectionState>(initialState);

export const currentUserVideoRef = writable<HTMLVideoElement>();
export const remoteUserVideoRef = writable<HTMLVideoElement>();
export const videoCallDialogOpen = writable<boolean>(false);

export const relayMessages = writable<Map<string, RelayMessage[]>>(new Map());
