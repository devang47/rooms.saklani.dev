<script lang="ts">
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
  class="pointer-events-auto w-full max-w-[200px] overflow-hidden rounded-lg border font-sans shadow-lg ring-1 ring-black/5"
  transition:scale={{ start: 0.9, opacity: 0 }}
>
  <div class="px-4 py-2.5">
    <div class="flex items-center">
      <div class="flex w-0 flex-1 justify-between">
        <p class="w-0 flex-1 text-sm font-medium text-white">
          {data.data}
        </p>
      </div>
    </div>
  </div>
</div>
