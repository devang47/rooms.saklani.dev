<script lang="ts">
  import { easeOut, reduceMotion } from "#utils/motion.ts";
  import { scale } from "svelte/transition";

  interface Props {
    data: CustomNotification;
    error?: boolean;
  }

  let { data, error = false }: Props = $props();
</script>

<div
  class:bg-red-700={error}
  class:border-red-300={error}
  class:bg-sky-500={!error}
  class:border-sky-300={!error}
  class="pointer-events-auto border w-full max-w-[200px] overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 font-sans"
  transition:scale|global={{
    start: reduceMotion ? 1 : 0.95,
    opacity: 0,
    duration: 200,
    easing: easeOut,
  }}
>
  <div class="py-2.5 px-4">
    <div class="flex items-center">
      <div class="flex w-0 flex-1 justify-between">
        <p class="w-0 flex-1 text-sm font-medium text-white">
          {data.data}
        </p>
      </div>
    </div>
  </div>
</div>
