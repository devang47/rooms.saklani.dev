<script lang="ts">
  import QRCode from "qrcode";
  import Dustbin from "$lib/icons/Dustbin.svelte";
  import { roomData, roomMessages } from "$stores";
  import { addNotification } from "$utils/notifications";
  import { onDestroy, tick } from "svelte";
  import Modal from "./Modal.svelte";
  import { ROOM_TTL_MS } from "$helpers/Room";

  export let roomId: string;
  export let handleDeleteRoom: () => void;

  const copyText = () => {
    navigator.clipboard.writeText(roomId);

    addNotification("Copied to clipboard!", false);
  };

  // Recomputed from the clock every second, so it can't drift or go negative.
  let now = Date.now();
  const clock = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(clock));

  const pad = (n: number) => String(n).padStart(2, "0");
  $: remaining = Math.max(0, ($roomData?.timestamp ?? 0) + ROOM_TTL_MS - now);
  $: timeRemainingBeforeRoomDeletion = !$roomData?.timestamp
    ? ""
    : remaining
      ? `${pad(Math.floor(remaining / 60000))}:${pad(Math.floor(remaining / 1000) % 60)}`
      : "Expired";
  let isQrModalOpen = false;

  let canvasEl: HTMLCanvasElement;
  const createQrCode = async () => {
    isQrModalOpen = true;

    await tick();

    QRCode.toCanvas(
      canvasEl,
      `${location.origin}/room/${roomId ?? ""}`,
      { width: 300 },
      function (error: any) {
        if (error) console.error(error);
      }
    );
  };

</script>

<header>
  <a href="/" on:click={() => ($roomMessages = [])}>
    <h1 class="sans cursor-pointer">ChatRooms</h1>
  </a>
  <div class="flex items-center gap-3 lg:gap-5">
    <div class="text-light text-[15px] hidden sm:block">
      {timeRemainingBeforeRoomDeletion}
    </div>

    <button
      aria-label="view qr code"
      class="btn-secondary !px-2"
      on:click={createQrCode}
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
      on:click={copyText}
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
      on:click={handleDeleteRoom}
      class="delete-btn"
    >
      <Dustbin />
    </button>
  </div>
</header>

{#if isQrModalOpen}
  <Modal onClose={() => (isQrModalOpen = false)}>
    <canvas class="w-full" bind:this={canvasEl} />
  </Modal>
{/if}
