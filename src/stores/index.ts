import { writable } from "svelte/store";

export const roomMessages = writable<any>([]);
export let loading = writable<boolean>(true);
export let loadingUpload = writable<boolean>(false);
export let notifications = writable<CustomNotification[]>([]);
export let roomData = writable<any>(false);

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
