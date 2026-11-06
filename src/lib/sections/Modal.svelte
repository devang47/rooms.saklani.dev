<script lang="ts">
  import type { Snippet } from "svelte";

  let { onClose, children }: { onClose: () => void; children: Snippet } =
    $props();

  let dialog: HTMLDialogElement;
  $effect(() => dialog.showModal());
</script>

<!-- Native modal <dialog>: focus trap, Escape and top layer for free. A click whose target is
     the <dialog> itself landed on the backdrop (the content lives in the inner div). -->
<dialog
  bind:this={dialog}
  onclose={onClose}
  onclick={(e) => e.target === dialog && dialog.close()}
  class="m-auto h-fit w-fit max-w-md animate-[fade-in_0.2s] rounded-lg bg-light p-0 backdrop:bg-black/50"
>
  <div class="px-4 py-2">
    {@render children()}
  </div>
</dialog>
