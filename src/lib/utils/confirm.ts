import { writable } from "svelte/store";

interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (accepted: boolean) => void;
}

/** Pending questions; ConfirmDialog shows the first one. */
export const confirmQueue = writable<ConfirmRequest[]>([]);

/** Non-blocking replacement for window.confirm. */
export const askConfirm = (
  message: string,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
) =>
  new Promise<boolean>((resolve) =>
    confirmQueue.update((q) => [
      ...q,
      { message, confirmLabel, cancelLabel, resolve },
    ]),
  );
