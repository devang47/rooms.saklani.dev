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
    roomData,
    roomMessages,
    uploadProgress,
  } from "#lib/stores/index.ts";
  import { addNotification } from "#lib/utils/notifications.ts";
  import {
    addMessage,
    checkIfRoomExists,
    deleteRoom,
    getRoomMessages,
    MAX_MESSAGE_LENGTH,
    ROOM_TTL_MS,
  } from "#lib/helpers/Room.ts";
  import { chatInput as chatInputAction } from "#lib/hooks/chatInput.ts";
  import { onDestroy, onMount } from "svelte";

  let scrollToElement = $state<HTMLDivElement>();
  let chatInput = $state("");
  let uploadFileInput = $state<HTMLInputElement>();
  let unsubscribe: (() => void) | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let left = false;

  const roomId = $derived((page.params.id ?? "").toUpperCase());

  loading.set(true); // until the room is checked and subscribed

  const leave = (message?: string) => {
    if (left) return;
    left = true;
    unsubscribe?.();
    clearTimeout(expiryTimer);
    $roomMessages = [];
    if (message) addNotification(message, true);
    goto("/");
  };

  onDestroy(() => {
    left = true;
    unsubscribe?.();
    clearTimeout(expiryTimer);
  });

  onMount(async () => {
    try {
      $roomData = await checkIfRoomExists(roomId);
    } catch {
      return leave("Couldn't open the room, please check your connection");
    }
    if (!$roomData) return leave("Room doesn't exist or has expired");

    const unsub = await getRoomMessages(roomId, scrollToBottom, () =>
      leave("This room has expired or was deleted"),
    );
    if (left) return unsub(); // navigated away while subscribing
    unsubscribe = unsub;

    expiryTimer = setTimeout(
      () => leave("This room has expired"),
      $roomData.timestamp + ROOM_TTL_MS - Date.now(),
    );
    loading.set(false);
  });

  const handleAddMsg = async () => {
    const msg = chatInput.trim();
    if (!msg) return;

    chatInput = "";
    try {
      await addMessage({ roomId, message: msg });
      scrollToBottom();
    } catch {
      chatInput = msg; // give it back so nothing is lost
      addNotification("Message not sent, please try again", true);
    }
  };

  const handleInputChange = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow picking the same file again
    if (!file) return;

    $loading = true;
    $uploadProgress = 0;
    try {
      const { uploadFile } = await import("#lib/helpers/storage.ts");
      const url = await uploadFile(
        roomId,
        file,
        (percent) => ($uploadProgress = percent),
      );
      chatInput = chatInput.trim() ? `${chatInput} ${url}` : url;
    } catch (error: any) {
      // Our own errors (size limit) are readable; Firebase ones are not.
      addNotification(
        error?.code ? "Failed to upload file" : error.message,
        true,
      );
    } finally {
      $loading = false;
      $uploadProgress = null;
    }
  };

  const handleDeleteRoom = async () => {
    $loading = true;
    unsubscribe?.(); // our own deletion shouldn't trigger the "room deleted" path
    unsubscribe = undefined;
    try {
      await deleteRoom(roomId);
      leave();
    } catch {
      leave("Couldn't delete the room, it will expire on its own");
    }
  };

  const scrollToBottom = () => {
    if (scrollToElement) {
      scrollToElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };
</script>

<section class="chat-ui">
  <div class="container">
    <ChatHeader {roomId} {handleDeleteRoom} />

    <div class="chat-messages-wrapper h-[calc(90vh-65.6px)] pb-[200px]">
      <div class="messages-wrapper">
        {#if !$roomMessages.length}
          <div class="placeholder">
            <SendIcon color="#555E69" />

            <h2 class="">Type and send a message to get started!</h2>

            <div class="commands-table hidden sm:block">
              <table border={1}>
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
          {#each $roomMessages as item (item.id)}
            <Message messageData={item} />
          {/each}
        {/if}

        <div class="scroll-bottom" bind:this={scrollToElement}></div>
      </div>

      <div
        class="chat-input absolute right-0 bottom-0 left-0 flex items-start gap-x-4 rounded-b-[30px] bg-linear-to-t from-light to-transparent px-4 pb-8 sm:px-6 md:gap-x-6 md:rounded-b-[40px] md:px-12"
      >
        <textarea
          title="Chat input"
          placeholder="Enter something..."
          name="chat-input"
          id="input"
          cols="30"
          rows="10"
          maxlength={MAX_MESSAGE_LENGTH}
          use:chatInputAction={handleAddMsg}
          bind:value={chatInput}></textarea>
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
