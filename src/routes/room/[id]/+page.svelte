<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Message from "#lib/components/MessageItem.svelte";
  import Github from "#lib/icons/Github.svelte";
  import SendIcon from "#lib/icons/SendIcon.svelte";
  import UploadIcon from "#lib/icons/UploadIcon.svelte";
  import ChatHeader from "#lib/sections/ChatHeader.svelte";
  import {
    loading,
    loadingUpload,
    roomData,
    roomMessages,
    user,
  } from "#stores";
  import { addNotification } from "#utils/notifications.ts";
  import {
    addMessage,
    checkIfRoomExists,
    deleteRoom,
    getRoomMessages,
  } from "#helpers/Room.ts";
  import { ensureSignedIn } from "#utils/config.ts";
  import { onDestroy, onMount } from "svelte";

  const roomId = (page.params.id ?? "").toUpperCase();
  let messagesEl = $state<HTMLDivElement>();
  // Messages already in the room when it opens appear without animating.
  let ready = $state(false);
  let atBottom = true;
  let unseen = $state(false);
  let chatInput = $state("");
  let chatInputBox = $state<HTMLTextAreaElement>();
  let uploadFileInput = $state<HTMLInputElement>();
  let dragging = $state(false);
  let unsubscribe: (() => void) | undefined;

  const ROOM_LIFETIME_MS = 15 * 60 * 1000;
  let now = $state(Date.now());
  const secondsLeft = $derived(
    $roomData.timestamp
      ? Math.max(
          0,
          Math.floor((ROOM_LIFETIME_MS - (now - $roomData.timestamp)) / 1000),
        )
      : null,
  );
  const remaining = $derived.by(() => {
    // Blank until the room has loaded.
    if (secondsLeft === null) return "";
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(Math.floor(secondsLeft / 60))}:${pad(secondsLeft % 60)}`;
  });

  let warned = false;
  let expired = false;
  $effect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft > 0 && secondsLeft <= 60 && !warned) {
      warned = true;
      addNotification("This room is deleted in under a minute", true, 5000);
    }
    if (secondsLeft === 0 && !expired) {
      expired = true;
      addNotification("This room has expired", true, 4000);
      $roomMessages = [];
      goto("/");
    }
  });

  // Coming from create or join, the room is already known, so show it right away.
  if (!$roomData) $loading = true;

  onMount(async () => {
    const clock = setInterval(() => (now = Date.now()), 1000);
    onDestroy(() => clearInterval(clock));

    // Marks which messages are this user's.
    ensureSignedIn().catch((error) => addNotification(error.message, true));

    $roomData = await checkIfRoomExists(roomId);
    if (!$roomData) {
      $roomMessages = [];
      addNotification("Room doesn't exist", true);
      await goto("/");
    } else {
      unsubscribe = await getRoomMessages(roomId, handleUpdate);
    }
    $loading = false;
  });

  onDestroy(() => unsubscribe?.());

  const handleKeydown = (e: KeyboardEvent) => {
    // On phones Enter adds a new line; the send button sends.
    if (innerWidth < 640 || e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    handleAddMsg();
  };

  const focusOnInput = (e: KeyboardEvent) => {
    if (innerWidth < 640 || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === "/") {
      e.preventDefault();
      chatInputBox?.focus();
    }
  };

  const handleAddMsg = async () => {
    chatInput = chatInput.trim();
    if (!chatInput) return;

    let msg = chatInput;
    chatInput = "";
    try {
      await addMessage({ roomId, message: msg });
    } catch (error) {
      console.log(error);
      chatInput = msg;
      addNotification("Message not sent. The room may have expired.", true);
      return;
    }
    if (innerWidth > 640) {
      chatInputBox?.focus();
    }
  };

  const upload = async (file: File) => {
    $loading = true;
    $loadingUpload = true;
    try {
      const { uploadFile } = await import("#helpers/storage.ts");
      const url = await uploadFile(roomId, file);
      chatInput = chatInput.trim() ? `${chatInput} ${url}` : `${url}`;
    } catch (error) {
      // uploadFile has already shown the reason.
      console.log(error);
    }
    $loading = false;
    $loadingUpload = false;
  };

  const handleInputChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) upload(file);
  };

  const handlePaste = (e: ClipboardEvent) => {
    const file = e.clipboardData?.files[0];
    if (!file) return;
    e.preventDefault();
    upload(file);
  };

  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) upload(file);
  };

  const handleDeleteRoom = async () => {
    $loading = true;
    await deleteRoom(roomId);
    $roomMessages = [];
    await goto("/");
    $loading = false;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEl?.scrollTo({ top: messagesEl.scrollHeight, behavior });
    unseen = false;
  };

  // Only scrolling up unpins, so a smooth scroll to the bottom never does.
  let lastTop = 0;
  const handleScroll = () => {
    if (!messagesEl) return;
    const { scrollHeight, scrollTop, clientHeight } = messagesEl;
    if (scrollHeight - scrollTop - clientHeight < 80) {
      atBottom = true;
      unseen = false;
    } else if (scrollTop < lastTop) {
      atBottom = false;
    }
    lastTop = scrollTop;
  };

  // Keeps the newest message in view while images load and change its height.
  const stayAtBottom = (list: HTMLElement) => {
    const observer = new ResizeObserver(() => {
      if (atBottom) messagesEl?.scrollTo({ top: messagesEl.scrollHeight });
    });
    observer.observe(list);
    return { destroy: () => observer.disconnect() };
  };

  // Follows new messages only when the reader is already at the bottom, or
  // sent the message themselves; otherwise it offers a "new messages" button.
  const handleUpdate = (first: boolean) => {
    const last = $roomMessages.at(-1);
    if (first) {
      scrollToBottom("instant");
      ready = true;
    } else if (atBottom || last?.device === $user?.uid) {
      scrollToBottom();
    } else {
      unseen = true;
    }
  };
</script>

<svelte:window onkeydown={focusOnInput} />

<section class="chat-ui">
  <div
    class="container"
    role="region"
    aria-label="Chat"
    ondragover={(e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragging = true;
    }}
    ondragleave={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) dragging = false;
    }}
    ondrop={handleDrop}
  >
    {#if dragging}
      <div
        class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[30px] border-2 border-dashed border-[#7F8691] bg-light/80 font-medium text-dark md:rounded-[40px]"
      >
        Drop to upload
      </div>
    {/if}
    <ChatHeader
      {roomId}
      {remaining}
      urgent={secondsLeft !== null && secondsLeft <= 60}
      {handleDeleteRoom}
    />

    <div
      class="chat-messages-wrapper flex-1 pb-[200px]"
      bind:this={messagesEl}
      onscroll={handleScroll}
    >
      <div class="messages-wrapper" use:stayAtBottom>
        {#if !$roomMessages.length}
          <div class="placeholder">
            <SendIcon color="#555E69" />

            <h2 class="">Type and send a message to get started!</h2>

            <div class="commands-table hidden sm:block">
              <table class="" border={1}>
                <tbody>
                  <tr>
                    <td> <code> enter </code> </td>
                    <td>Send Message</td>
                  </tr>
                  <tr>
                    <td> <code> shift + enter </code> </td>
                    <td>New line</td>
                  </tr>
                  <tr>
                    <td> <code> / </code> </td>
                    <td>Focus on input</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        {:else}
          {#each $roomMessages as item}
            <Message encrypted enter={ready} messageData={item} />
          {/each}
        {/if}
      </div>

      <button
        class="new-messages"
        data-visible={unseen || undefined}
        tabindex={unseen ? 0 : -1}
        aria-hidden={!unseen}
        onclick={() => scrollToBottom()}>New messages ↓</button
      >

      <div
        class="chat-input absolute bottom-0 left-0 right-0 flex items-start gap-x-4 rounded-b-[30px] bg-gradient-to-t from-light to-transparent px-4 pb-8 sm:px-6 md:gap-x-6 md:rounded-b-[40px] md:px-12"
      >
        <textarea
          title="Chat input"
          placeholder="Enter something..."
          name="chat-input"
          id="input"
          cols="30"
          rows="10"
          bind:this={chatInputBox}
          bind:value={chatInput}
          onkeydown={handleKeydown}
          onpaste={handlePaste}></textarea>
        <div class="buttons flex flex-col gap-2 md:gap-4">
          <button
            onclick={handleAddMsg}
            aria-label="send message button"
            title="Send message"
            class="button"
          >
            <div class="sr-only">Send message</div>
            <SendIcon />
          </button>
          <button
            class="upload button cursor-pointer"
            title="Upload media"
            aria-label="Upload media button"
            onclick={() => uploadFileInput?.click()}
          >
            <label for="fileinput" class="sr-only">Upload media</label>
            <div title="Upload media" class="upload-icon text-white">
              <UploadIcon />
            </div>
            <input
              multiple={false}
              bind:this={uploadFileInput}
              type="file"
              class="hidden"
              name="fileinput"
              id="fileinput"
              onchange={handleInputChange}
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</section>

<div
  class="absolute top-4 hidden w-7 text-sm text-white md:right-4 md:block lg:right-6"
>
  <a
    href="https://github.com/Devang47/rooms.saklani.dev"
    target="_blank"
    rel="noopener noreferrer"
    class="w-full underline"
  >
    <Github />
  </a>
</div>
