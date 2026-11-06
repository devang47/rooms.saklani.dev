<script lang="ts">
import { addNotification } from "$utils/notifications";
import { scale } from "svelte/transition";
import CopyIcon from "$lib/icons/CopyIcon.svelte";
import { connectionState } from "$stores";

export let messageData: Message;
export let showMetadata = false;

// Room messages carry `mine`; P2P messages are matched against our peer ID.
$: sameDevice = messageData.mine ?? messageData.deviceId === $connectionState.id;
$: message = messageData.data;

let done = false;
const copyText = () => {
  navigator.clipboard.writeText(message);
  done = true;
  addNotification("Copied to clipboard!", false);
};
</script>

<div
  class="message-item"
  transition:scale={{ start: 0.9, opacity: 0.8 }}
  class:right-aligned={sameDevice}
  class:left-aligned={!sameDevice}
>
  <p class="w-full font-medium">{message}</p>

  {#if showMetadata}
    <div class="mt-2 flex items-center gap-2 text-xs opacity-50">
      <div class="">
        {messageData.deviceId}
      </div>
      |
      <div class="">
        {new Date(messageData.timestamp).toLocaleTimeString("en-US", {
          hour12: true,
          hour: "numeric",
          minute: "numeric",
        })}
      </div>
    </div>
  {/if}

  <button
    aria-label="copy text"
    class:done={done}
    on:click={copyText}
    title="copy text"
    class="copy-btn"
  >
    <div class="sr-only">copy text</div>
    <CopyIcon />
  </button>
</div>
