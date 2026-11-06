<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import Message from "$lib/components/MessageItem.svelte";
import Github from "$lib/icons/Github.svelte";
import SendIcon from "$lib/icons/SendIcon.svelte";
import UploadIcon from "$lib/icons/UploadIcon.svelte";
import ChatHeader from "$lib/sections/ChatHeader.svelte";
import { loading, loadingUpload, roomData, roomMessages } from "$stores";
import { addNotification } from "$utils/notifications";
import {
  addMessage,
  checkIfRoomExists,
  deleteRoom,
  getRoomMessages,
  MAX_MESSAGE_LENGTH,
} from "$helpers/Room";
import { uploadFile } from "$helpers/storage";
import { onDestroy, onMount } from "svelte";

let roomId: string;
let scrollToElement: HTMLDivElement;
let chatInput = "";
let chatInputBox: HTMLTextAreaElement;
let uploadFileInput: HTMLInputElement;
let unsubscribe: (() => void) | undefined;

onDestroy(() => unsubscribe?.());

onMount(async () => {
  roomId = $page.params.id.toUpperCase() as string;

  $roomData = await checkIfRoomExists(roomId);
  if (!$roomData) {
    $roomMessages = [];
    addNotification("Room doesn't exists", true);
    goto("/");
  } else {
    unsubscribe = await getRoomMessages(roomId, scrollToBottom);
    loading.set(false);
  }

  chatInputBox.addEventListener("keypress", (e) => {
    if (innerWidth < 640) return;

    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      chatInput += "\r\n";
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleAddMsg();
    } else if (e.key === "/") {
    }
  });

  window.addEventListener("keypress", focusOnInput);
});

const focusOnInput = (e: KeyboardEvent) => {
  if (innerWidth < 640) return;

  if (e.key === "/") {
    chatInputBox.focus();
  }
};

$: roomId = ($page.params.id || "").toUpperCase() as string;

const handleAddMsg = async () => {
  chatInput = chatInput.trim();
  if (!chatInput) return;

  let msg = chatInput;
  chatInput = "";
  await addMessage({ roomId, message: msg });
  scrollToBottom();
  if (innerWidth > 640) {
    chatInputBox.focus();
  }
};

const handleInputChange = async (e: Event) => {
  const input = e.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow picking the same file again
  if (!file) return;

  $loading = true;
  $loadingUpload = true;
  try {
    const url = await uploadFile(roomId, file);
    chatInput = chatInput.trim() ? `${chatInput} ${url}` : url;
  } catch (error: any) {
    // Our own errors (size limit) are readable; Firebase ones are not.
    addNotification(error?.code ? "Failed to upload file" : error.message, true);
  } finally {
    $loading = false;
    $loadingUpload = false;
  }
};

const handleDeleteRoom = async () => {
  $loading = true;
  try {
    await deleteRoom(roomId);
  } catch {
    addNotification("Couldn't delete the room, it will expire on its own", true);
  }
  unsubscribe?.();
  $roomMessages = [];
  goto("/");
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
    <ChatHeader roomId={roomId} handleDeleteRoom={handleDeleteRoom} />

    <div class="chat-messages-wrapper h-[calc(90vh-65.6px)] pb-[200px]">
      <div class="messages-wrapper">
        {#if !$roomMessages.length}
          <div class="placeholder">
            <SendIcon color="#555E69" />

            <h2 class="">Type and send a message to get started!</h2>

            <div class="commands-table hidden sm:block">
              <table class="" border={1}>
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
              </table>
            </div>
          </div>
        {:else}
          {#each $roomMessages as item (item.id)}
            <Message messageData={item} />
          {/each}
        {/if}

        <div class="scroll-bottom" bind:this={scrollToElement} />
      </div>

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
          maxlength={MAX_MESSAGE_LENGTH}
          bind:this={chatInputBox}
          bind:value={chatInput}
        />
        <div class="buttons flex flex-col gap-2 md:gap-4">
          <button
            on:click={handleAddMsg}
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
            on:click={() => uploadFileInput.click()}
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
              on:change={handleInputChange}
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
