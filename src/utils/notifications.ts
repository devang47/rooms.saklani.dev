import { notifications } from "$stores";

let nextId = 0;

/** Shows a toast. Errors stay longer by default so they can be read. */
export const addNotification = (
  msg: string,
  error = false,
  timeout?: number,
) => {
  const id = ++nextId;
  notifications.update((list) => [...list, { id, data: msg, error }]);
  setTimeout(
    () => notifications.update((list) => list.filter((n) => n.id !== id)),
    timeout ?? (error ? 4000 : 2000),
  );
};
