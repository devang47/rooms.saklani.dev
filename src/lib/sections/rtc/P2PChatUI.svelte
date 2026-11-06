<script lang="ts">
  import { connectionState, relayMessages } from "#lib/stores/index.ts";
  import { addNotification } from "#lib/utils/notifications.ts";
  import { tick } from "svelte";
  import MessageItem from "#lib/components/MessageItem.svelte";
  import { sendFile, sendMessage, startCall } from "#lib/helpers/peer/index.ts";
  import { chatInput } from "#lib/hooks/chatInput.ts";
  import UploadIcon from "#lib/icons/UploadIcon.svelte";
  import CallIcon from "#lib/icons/CallIcon.svelte";

  let text = $state("");
  let uploadFileInput = $state<HTMLInputElement>();

  const selectedId = $derived($connectionState.selectedId);
  const messages = $derived(
    (selectedId && $relayMessages.get(selectedId)) || [],
  );

  const scrollToBottom = async () => {
    await tick();
    document.body.scrollTop = document.body.scrollHeight;
  };

  const handleSend = () => {
    if (!selectedId) return addNotification("Please select a connection", true);
    const message = text.trim();
    if (!message) return;

    try {
      sendMessage(selectedId, message);
      text = "";
    } catch (err: any) {
      addNotification(err?.message || "Error when sending message", true);
    }
  };

  const handleFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow sending the same file again
    if (!file || !selectedId) return;

    try {
      await sendFile(selectedId, file);
    } catch (err: any) {
      addNotification(
        err?.message || `Failed to deliver file to ${selectedId}`,
        true,
      );
    }
  };
  // Follow new messages.
  $effect(() => {
    if (messages.length) scrollToBottom();
  });
</script>

<div class="chat-messages-wrapper min-h-[350px] pb-52! md:px-5!">
  <div class="messages-wrapper">
    {#if !messages.length}
      <div class="placeholder text-sm">No recent messages</div>
    {:else}
      {#each messages as item}
        <MessageItem showMetadata messageData={item} />
      {/each}
    {/if}
  </div>
</div>

<div
  class="chat-input absolute right-0 bottom-0 left-0 flex items-start gap-x-4 rounded-b-xl px-4 pb-5 sm:px-6 md:px-12 md:pb-12"
>
  <textarea
    title="Chat input"
    placeholder="Enter something..."
    name="chat-input"
    class="rounded-xl! px-5! py-4! text-sm!"
    id="input"
    rows="2"
    maxlength="10000"
    use:chatInput={handleSend}
    bind:value={text}></textarea>
  <div class="flex flex-col gap-4">
    <button
      class="w-full rounded-md bg-dark px-4 py-2 text-xs font-bold text-light disabled:cursor-not-allowed"
      onclick={handleSend}
      disabled={!selectedId}
      title="Send message"
    >
      Send
    </button>

    <button
      class="btn-secondary w-full rounded-md bg-light px-4 py-2 text-xs font-bold shadow-sm disabled:cursor-not-allowed"
      title="Send a file (max 100 MB)"
      aria-label="Send a file"
      disabled={!selectedId}
      onclick={() => uploadFileInput?.click()}
    >
      <div class="w-5 text-dark">
        <UploadIcon />
      </div>
    </button>
    <input
      bind:this={uploadFileInput}
      type="file"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      onchange={handleFile}
    />

    <button
      class="btn-secondary w-full rounded-md bg-light px-4 py-1.5 text-xs font-bold shadow-sm disabled:cursor-not-allowed"
      title="Start a video call"
      aria-label="Start a video call"
      disabled={!selectedId}
      onclick={() => selectedId && startCall(selectedId)}
    >
      <div class="w-5 text-dark">
        <CallIcon class="w-5" />
      </div>
    </button>
  </div>
</div>
