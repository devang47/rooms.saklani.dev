import { prompts } from "#stores";

let nextId = 0;

// Shows an inline accept/decline card and resolves with the answer. Unanswered
// requests are declined after the timeout.
export const ask = (
  text: string,
  { accept = "Accept", decline = "Decline", timeoutMs = 30_000 } = {},
) =>
  new Promise<boolean>((resolve) => {
    const id = nextId++;
    const answer = (accepted: boolean) => {
      clearTimeout(timer);
      prompts.update((list) => list.filter((prompt) => prompt.id !== id));
      resolve(accepted);
    };
    const timer = setTimeout(() => answer(false), timeoutMs);
    prompts.update((list) => [...list, { id, text, accept, decline, answer }]);
  });
