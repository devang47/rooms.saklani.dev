<script lang="ts">
import { confirmQueue } from "$utils/confirm";

let dialog: HTMLDialogElement;

$: current = $confirmQueue[0];
// Native <dialog>: top layer, focus trap and Escape (fires `cancel`) for free.
$: if (dialog) {
  if (current && !dialog.open) dialog.showModal();
  if (!current && dialog.open) dialog.close();
}

const answer = (accepted: boolean) => {
  current?.resolve(accepted);
  confirmQueue.update((q) => q.slice(1));
};
</script>

<dialog
  bind:this={dialog}
  on:cancel|preventDefault={() => answer(false)}
  class="w-[min(24rem,calc(100%-2rem))] rounded-xl bg-light p-5 font-mono text-dark shadow-xl backdrop:bg-black/50"
>
  {#if current}
    <p class="text-sm font-medium">{current.message}</p>
    <div class="mt-5 flex justify-end gap-3">
      <button
        class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
        on:click={() => answer(false)}>{current.cancelLabel}</button
      >
      <button
        class="rounded-lg bg-[#555E69] px-4 py-2 text-sm font-medium text-light"
        on:click={() => answer(true)}>{current.confirmLabel}</button
      >
    </div>
  {/if}
</dialog>
