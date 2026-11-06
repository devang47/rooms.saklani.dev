<script lang="ts">
  import { addNotification } from "#lib/utils/notifications.ts";
  import { scale } from "svelte/transition";
  import CopyIcon from "#lib/icons/CopyIcon.svelte";
  import { connectionState } from "#lib/stores/index.ts";

  interface Props {
    messageData: Message;
    showMetadata?: boolean;
  }

  let { messageData, showMetadata = false }: Props = $props();

  // Room messages carry `mine`; P2P messages are matched against our peer ID.
  let sameDevice = $derived(
    messageData.mine ?? messageData.deviceId === $connectionState.id,
  );
  let message = $derived(messageData.data);

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  let done = $state(false);
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
  {#if messageData.file}
    <a
      class="w-full font-medium break-all underline"
      href={messageData.file.url}
      download={messageData.file.name}
      >📎 {messageData.file.name}
      <span class="text-xs opacity-60"
        >({formatSize(messageData.file.size)})</span
      ></a
    >
  {:else}
    <p class="w-full font-medium">{message}</p>
  {/if}

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
    class:done
    onclick={copyText}
    title="copy text"
    class="copy-btn"
  >
    <div class="sr-only">copy text</div>
    <CopyIcon />
  </button>
</div>
