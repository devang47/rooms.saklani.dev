<script lang="ts">
  import { onMount } from "svelte";
  import { decrypt, deriveRoom } from "#helpers/crypt.ts";
  import { addNotification } from "#utils/notifications.ts";
  import { scale } from "svelte/transition";
  import CopyIcon from "#lib/icons/CopyIcon.svelte";
  import { connectionState, user } from "#stores";
  import { linkify, uploadsPrefix } from "#utils/format.ts";

  interface Props {
    messageData: RelayMessage;
    roomId?: string;
    encrypted?: boolean;
    showMetadata?: boolean;
  }

  let {
    messageData,
    roomId = "",
    encrypted = false,
    showMetadata = false,
  }: Props = $props();

  let message = $state("");

  let sameDevice = $derived(
    encrypted
      ? messageData.device === $user?.uid
      : messageData.deviceId === $connectionState.id,
  );

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

  const parts = $derived(linkify(message, uploadsPrefix()));
  const time = $derived(
    new Date(messageData.timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  );

  let done = $state(false);
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
  <p class="w-full font-medium">
    {#each parts as part}{#if "text" in part}{part.text}{:else if part.image}<a
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          ><img
            src={part.href}
            alt="Shared in the room"
            loading="lazy"
            referrerpolicy="no-referrer"
            class="my-1 block max-h-64 rounded-lg"
          /></a
        >{:else}<a href={part.href} target="_blank" rel="noopener noreferrer"
          >{part.href}</a
        >{/if}{/each}
  </p>

  <div class="mt-2 flex items-center gap-2 text-xs opacity-50">
    {#if showMetadata}
      <div>{messageData.deviceId}</div>
      |
    {/if}
    <time datetime={new Date(messageData.timestamp).toISOString()}>{time}</time>
  </div>

  <button
    aria-label="copy text"
    class:done
    onclick={copyText}
    title="copy text"
    class="copy-btn"
  >
    <div class="sr-only">copy text</div>
    <CopyIcon />
  </button>
</div>
