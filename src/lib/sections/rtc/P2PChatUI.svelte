<script lang="ts">
  import { connectionState, relayMessages, transfers } from "#stores";
  import { addNotification } from "#utils/notifications.ts";
  import { tick } from "svelte";
  import MessageItem from "#lib/components/MessageItem.svelte";
  import { DataType, PeerConnection } from "#helpers/peer/index.ts";
  import UploadIcon from "#lib/icons/UploadIcon.svelte";
  import FileCard from "#lib/components/FileCard.svelte";
  import { offerFile } from "#helpers/peer/files.ts";
  import CallIcon from "#lib/icons/CallIcon.svelte";

  let chatInput = $state("");
  let chatInputBox = $state<HTMLTextAreaElement>();
  let uploadFileInput = $state<HTMLInputElement>();
  interface Props {
    handleCallPeer: (id: string) => void;
  }

  let { handleCallPeer }: Props = $props();

  const handleInputChange = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    const selectedId = $connectionState.selectedId;
    if (!file) return;
    if (!selectedId) {
      addNotification("Please select a connection", true);
      return;
    }

    try {
      await offerFile(selectedId, file);
    } catch (error) {
      console.log(error);
      addNotification("Failed to deliver file to " + selectedId, true);
    }
  };

  const handleAddMsg = async () => {
    const selectedId = $connectionState.selectedId;
    if (!selectedId) {
      addNotification("Please select a connection", true);
      return;
    }

    chatInput = chatInput.trim();
    if (!chatInput) {
      addNotification("Input is empty", true);
      return;
    }

    try {
      let msg = chatInput;

      const data = {
        dataType: DataType.MESSAGE,
        message: msg,
        deviceId: $connectionState.id ?? "",
        timestamp: new Date().toString(),
      };

      await PeerConnection.sendConnection(selectedId, data);
      relayMessages.update((msgs) => {
        msgs.set(selectedId, [
          ...(msgs.get(selectedId) ?? []),
          {
            data: data.message,
            device: data.deviceId,
            deviceId: data.deviceId,
            timestamp: data.timestamp,
          },
        ]);

        return msgs;
      });

      chatInput = "";

      if (innerWidth > 640) {
        chatInputBox?.focus();
      }
    } catch (err) {
      console.log(err);
      addNotification("Error when sending message");
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    // On phones Enter adds a new line; the Send button sends.
    if (innerWidth < 640 || e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    handleAddMsg();
  };

  const focusOnInput = (e: KeyboardEvent) => {
    if (innerWidth < 640 || e.target instanceof HTMLTextAreaElement) return;
    if (e.target instanceof HTMLInputElement) return;

    if (e.key === "/") {
      e.preventDefault();
      chatInputBox?.focus();
    }
  };

  const messages = $derived(
    $relayMessages.get($connectionState.selectedId ?? "") ?? [],
  );

  $effect(() => {
    if (!messages.length) return;
    tick().then(() => (document.body.scrollTop = document.body.scrollHeight));
  });
</script>

<svelte:window onkeydown={focusOnInput} />

<div class="chat-messages-wrapper min-h-[350px] !pb-52 md:!px-5">
  <div class="messages-wrapper">
    {#if !messages.length}
      <div class="placeholder text-sm">No recent messages</div>
    {:else}
      {#each messages as item}
        {#if item.fileId && $transfers[item.fileId]}
          <FileCard transfer={$transfers[item.fileId]} />
        {:else}
          <MessageItem showMetadata roomId={item.deviceId} messageData={item} />
        {/if}
      {/each}
    {/if}
  </div>
</div>

<div
  class="chat-input absolute bottom-0 left-0 right-0 flex items-start gap-x-4 rounded-b-xl px-4 pb-5 sm:px-6 md:px-12 md:pb-12"
>
  <textarea
    title="Chat input"
    placeholder="Enter something..."
    name="chat-input"
    class="!rounded-xl !px-5 !py-4 !text-sm"
    id="input"
    rows="2"
    bind:this={chatInputBox}
    bind:value={chatInput}
    onkeydown={handleKeydown}></textarea>
  <div class="flex flex-col gap-4">
    <button
      class="w-full rounded-md bg-dark px-4 py-2 text-xs font-bold text-light disabled:cursor-not-allowed"
      onclick={handleAddMsg}
      disabled={!$connectionState.selectedId}
      aria-label="send message button"
      title="Send message"
    >
      Send
    </button>

    <button
      class="btn-secondary w-full rounded-md bg-light px-4 py-2 text-xs font-bold shadow disabled:cursor-not-allowed"
      title="Upload media"
      aria-label="Upload media button"
      disabled={!$connectionState.selectedId}
      onclick={() => uploadFileInput?.click()}
    >
      <div title="Upload media" class="w-5 text-dark">
        <UploadIcon />
      </div>

      <label for="fileinput" class="sr-only">Upload media</label>
      <input
        multiple={false}
        bind:this={uploadFileInput}
        type="file"
        class="sr-only"
        name="fileinput"
        id="fileinput"
        onchange={handleInputChange}
      />
    </button>

    <button
      class="btn-secondary w-full rounded-md bg-light px-4 py-1.5 text-xs font-bold shadow disabled:cursor-not-allowed"
      title="Start a video call"
      aria-label="Start a video call"
      disabled={!$connectionState.selectedId}
      onclick={() => handleCallPeer($connectionState.selectedId ?? "")}
    >
      <div class="w-5 text-dark">
        <CallIcon class="w-5" />
      </div>
    </button>
  </div>
</div>
