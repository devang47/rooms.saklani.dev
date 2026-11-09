<script lang="ts">
  import { addNotification } from "#utils/notifications.ts";
  import CopyIcon from "#lib/icons/CopyIcon.svelte";
  import { connectionState, user } from "#stores";
  import { linkify, uploadsPrefix } from "#utils/format.ts";

  interface Props {
    messageData: RelayMessage;
    // Room messages compare against the signed-in user, P2P ones the peer ID.
    encrypted?: boolean;
    showMetadata?: boolean;
    // False for messages that were already there when the chat opened.
    enter?: boolean;
  }

  let {
    messageData,
    encrypted = false,
    showMetadata = false,
    enter = true,
  }: Props = $props();

  const message = $derived(messageData.data);

  let sameDevice = $derived(
    encrypted
      ? messageData.device === $user?.uid
      : messageData.deviceId === $connectionState.id,
  );

  const parts = $derived(linkify(message, uploadsPrefix()));
  const time = $derived(
    new Date(messageData.timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  );

  let copied = $state(false);
  let resetCopied: ReturnType<typeof setTimeout>;
  const copyText = () => {
    navigator.clipboard.writeText(message);
    copied = true;
    clearTimeout(resetCopied);
    resetCopied = setTimeout(() => (copied = false), 1500);
    addNotification("Copied to clipboard!", false);
  };
</script>

<div
  class="message-item"
  class:enter
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
        >{:else}<a
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          title={part.name ? part.href : undefined}>{part.name ?? part.href}</a
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
    data-copied={copied || undefined}
    onclick={copyText}
    title="copy text"
    class="copy-btn"
  >
    <div class="sr-only">copy text</div>
    <span class="copy-icon"><CopyIcon /></span>
    <svg
      class="check-icon"
      viewBox="0 0 18 22"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      ><path
        d="M2 12l5 5L16 6"
        stroke="#fff"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg
    >
  </button>
</div>
