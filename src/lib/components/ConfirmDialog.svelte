<script lang="ts">
  import { confirmQueue } from "#lib/utils/confirm.ts";

  let dialog: HTMLDialogElement;

  const current = $derived($confirmQueue[0]);

  // Native <dialog>: top layer, focus trap and Escape (fires `cancel`) for free.
  $effect(() => {
    if (current && !dialog.open) dialog.showModal();
    if (!current && dialog.open) dialog.close();
  });

  const answer = (accepted: boolean) => {
    current?.resolve(accepted);
    confirmQueue.update((q) => q.slice(1));
  };
</script>

<dialog
  bind:this={dialog}
  oncancel={(e) => {
    e.preventDefault();
    answer(false);
  }}
  class="m-auto w-[min(24rem,calc(100%-2rem))] rounded-xl bg-light p-5 font-mono text-dark shadow-xl backdrop:bg-black/50"
>
  {#if current}
    <p class="text-sm font-medium">{current.message}</p>
    <div class="mt-5 flex justify-end gap-3">
      <button
        class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
        onclick={() => answer(false)}>{current.cancelLabel}</button
      >
      <button
        class="rounded-lg bg-[#555E69] px-4 py-2 text-sm font-medium text-light"
        onclick={() => answer(true)}>{current.confirmLabel}</button
      >
    </div>
  {/if}
</dialog>
