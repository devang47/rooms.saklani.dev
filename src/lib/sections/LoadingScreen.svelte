<script lang="ts">
  import { fade } from "svelte/transition";
  import LoadingBar from "#lib/sections/LoadingBar.svelte";
  import { uploadProgress } from "#lib/stores/index.ts";
</script>

<section
  transition:fade={{ duration: 300 }}
  class="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-white"
>
  {#if $uploadProgress !== null}
    <LoadingBar progress={$uploadProgress} />
  {:else}
    <div
      class="w-fit rounded-sm bg-gray-100 p-3.5"
      role="status"
      aria-label="Loading"
    >
      <svg
        width="18"
        viewBox="0 0 16 16"
        fill="none"
        class="animate-spin stroke-gray-600"
      >
        <path
          d="M1.33325 8.00001C1.33325 11.6819 4.31802 14.6667 7.99992 14.6667C11.6818 14.6667 14.6666 11.6819 14.6666 8.00001C14.6666 4.31811 11.6818 1.33334 7.99992 1.33334"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  {/if}
</section>
