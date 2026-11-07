<script lang="ts">
  import QRCode from "qrcode";
  import Dustbin from "#lib/icons/Dustbin.svelte";
  import { roomData, roomMessages } from "#stores";
  import { addNotification } from "#utils/notifications.ts";
  import { onMount, tick } from "svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    roomId: string;
    handleDeleteRoom: () => void;
  }

  let { roomId, handleDeleteRoom }: Props = $props();

  const copyText = () => {
    navigator.clipboard.writeText(roomId);

    addNotification("Copied to clipboard!", false);
  };

  let isQrModalOpen = $state(false);
  let now = $state(Date.now());

  const timeRemainingBeforeRoomDeletion = $derived.by(() => {
    if (!$roomData.timestamp) return "Deleted";

    const seconds = Math.max(
      0,
      Math.floor((15 * 60000 - (now - $roomData.timestamp)) / 1000),
    );
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  });

  onMount(() => {
    const interval = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(interval);
  });

  let canvasEl = $state<HTMLCanvasElement>();
  const createQrCode = async () => {
    isQrModalOpen = true;

    await tick();

    QRCode.toCanvas(
      canvasEl,
      `https://rooms.saklani.dev/room/${roomId ?? ""}`,
      { width: 300 },
      function (error: any) {
        if (error) console.error(error);
      },
    );
  };
</script>

<header>
  <a href="/" onclick={() => ($roomMessages = [])}>
    <h1 class="sans cursor-pointer">ChatRooms</h1>
  </a>
  <div class="flex items-center gap-3 lg:gap-5">
    <div class="text-light text-[15px] hidden sm:block">
      {timeRemainingBeforeRoomDeletion}
    </div>

    <button
      aria-label="view qr code"
      class="btn-secondary !px-2"
      onclick={createQrCode}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        ><path
          fill="currentColor"
          d="M16 17v-1h-3v-3h3v2h2v2h-1v2h-2v2h-2v-3h2v-1h1Zm5 4h-4v-2h2v-2h2v4ZM3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm13-2h3v2h-3v-2ZM6 6h2v2H6V6Zm0 10h2v2H6v-2ZM16 6h2v2h-2V6Z"
        /></svg
      >
    </button>

    <button
      aria-label="copy room id"
      class="btn-secondary group"
      onclick={copyText}
    >
      {#each (roomId || "").split("") as letter}
        <span class="letter">
          {letter}
        </span>
      {/each}
    </button>

    <button
      aria-label="delete room"
      title="delete room"
      onclick={handleDeleteRoom}
      class="delete-btn"
    >
      <Dustbin />
    </button>
  </div>
</header>

{#if isQrModalOpen}
  <Modal onClose={() => (isQrModalOpen = false)}>
    <canvas class="w-full" bind:this={canvasEl}></canvas>
  </Modal>
{/if}
