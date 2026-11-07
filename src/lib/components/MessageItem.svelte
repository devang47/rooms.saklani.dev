<script lang="ts">
import { onMount } from "svelte";
import { decrypt, deriveRoom } from "$helpers/crypt";
import { addNotification } from "$utils/notifications";
import { scale } from "svelte/transition";
import CopyIcon from "$lib/icons/CopyIcon.svelte";
import { connectionState, user } from "$stores";

export let messageData: RelayMessage;
export let roomId = "";
export let encrypted = false;
export let showMetadata = false;

let message = "";

$: sameDevice = encrypted
  ? messageData.device === $user?.uid
  : messageData.deviceId === $connectionState.id;

onMount(async () => {
  if (!encrypted) {
    message = messageData.data;
    return;
  }

  try {
    const { key } = await deriveRoom(roomId);
    message = await decrypt(key, messageData.data);
  } catch {
    message = "Unable to decrypt this message";
  }
});

let done = false;
const copyText = () => {
  navigator.clipboard.writeText(message);
  done = true;
  addNotification("Copied to clipboard!", false);
};
</script>

<div
  class="message-item"
  transition:scale|global={{ start: 0.9, opacity: 0.8 }}
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
