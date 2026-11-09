<script lang="ts">
  import { easeOut, reduceMotion } from "#utils/motion.ts";
  import { clickOutside } from "#lib/hooks/useClickOutside.ts";
  import { fade, scale } from "svelte/transition";

  interface Props {
    onClose: () => void;
    children?: import("svelte").Snippet;
  }

  let { onClose, children }: Props = $props();
</script>

<section transition:fade|global={{ duration: 200, easing: easeOut }}>
  <div
    transition:scale|global={{
      start: reduceMotion ? 1 : 0.95,
      opacity: 0,
      duration: 200,
      easing: easeOut,
    }}
    use:clickOutside={onClose}
    class="modal"
  >
    {@render children?.()}
  </div>
</section>

<style lang="postcss">
  section {
    @apply fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-black/50;
  }

  .modal {
    @apply h-fit w-fit max-w-md rounded-lg bg-light px-4 py-2;
  }
</style>
