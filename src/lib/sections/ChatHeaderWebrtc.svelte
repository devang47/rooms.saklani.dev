<script lang="ts">
  import { connectionState } from "#lib/stores/index.ts";
  import { addNotification } from "#lib/utils/notifications.ts";
  import { startPeer, stopPeer } from "#lib/helpers/peer/index.ts";

  const copyText = () => {
    if (!$connectionState.id) return;
    navigator.clipboard.writeText($connectionState.id);

    addNotification("Copied to clipboard!", false);
  };
</script>

<header class="rounded-t-lg! md:px-6!">
  <a href="/">
    <h1 class="sans cursor-pointer whitespace-nowrap">P2P Rooms</h1>
  </a>
  <div class="flex items-center gap-3 lg:gap-5">
    {#if $connectionState.loading}
      <div class="px-4">
        <svg
          width="18"
          viewBox="0 0 16 16"
          fill="none"
          class={"animate-spin stroke-white"}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1.33325 8.00001C1.33325 11.6819 4.31802 14.6667 7.99992 14.6667C11.6818 14.6667 14.6666 11.6819 14.6666 8.00001C14.6666 4.31811 11.6818 1.33334 7.99992 1.33334"
            stroke="current"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    {/if}

    {#if $connectionState.id}
      <button
        aria-label="copy room id"
        class="relative flex cursor-pointer items-center justify-center gap-1 overflow-hidden rounded-sm bg-[#D9D9D9] px-3 py-1.5 text-sm text-[15px] font-extrabold text-dark md:px-4 md:py-2"
        onclick={copyText}
      >
        {$connectionState.id}
      </button>
    {/if}

    <button
      aria-label="toggle peerjs server"
      class="relative flex cursor-pointer items-center justify-center gap-1 overflow-hidden rounded-sm bg-[#D9D9D9] px-3 py-1.5 text-sm text-[15px] font-extrabold text-dark md:px-4 md:py-2"
      disabled={$connectionState.loading}
      onclick={$connectionState.started ? stopPeer : startPeer}
    >
      {#if $connectionState.started}
        Stop
      {:else}
        Start
      {/if}
    </button>
  </div>
</header>
