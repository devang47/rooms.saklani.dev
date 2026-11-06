<script lang="ts">
  import {
    connectionState,
    currentUserVideoRef,
    videoCallDialogOpen,
    loading,
    remoteUserVideoRef,
  } from "#lib/stores/index.ts";
  import { addNotification } from "#lib/utils/notifications.ts";
  import { onDestroy, onMount } from "svelte";
  import ChatHeaderWebrtc from "#lib/sections/ChatHeaderWebrtc.svelte";
  import StartServerScreen from "#lib/sections/rtc/StartServerScreen.svelte";
  import P2PChatUi from "#lib/sections/rtc/P2PChatUI.svelte";
  import {
    connectPeer,
    endCall,
    selectConnection,
    stopPeer,
  } from "#lib/helpers/peer/index.ts";

  onMount(() => {
    loading.set(false);
  });

  // Leaving the page releases the camera, connections and signaling socket.
  onDestroy(stopPeer);

  let newConnectionIdInput = $state("");
  let connecting = $state(false);

  const handleConnectOtherPeer = async (e: SubmitEvent) => {
    e.preventDefault();
    connecting = true;
    try {
      await connectPeer(newConnectionIdInput);
      newConnectionIdInput = "";
    } catch (err: any) {
      addNotification(err?.message || "Couldn't connect", true);
    } finally {
      connecting = false;
    }
  };

  let innerWidth = $state(0);

  // Stopping the server clears the half-typed ID.
  $effect(() => {
    if (!$connectionState.id) newConnectionIdInput = "";
  });
  const videoWidth = $derived(
    innerWidth > 768 ? 340 : innerWidth > 400 ? 300 : 250,
  );
</script>

<svelte:window bind:innerWidth />

<section class="chat-ui h-fit! min-h-screen py-20!">
  <div class="container h-fit! rounded-xl!">
    <ChatHeaderWebrtc />

    <div class="grid h-full md:p-6">
      <div class="rounded-xl border-neutral-300 md:border">
        {#if !$connectionState.started}
          <StartServerScreen />
        {:else}
          <form
            class="flex items-center gap-4 border-b border-neutral-300 p-4 md:gap-5 md:p-5"
            onsubmit={handleConnectOtherPeer}
          >
            <input
              type="text"
              maxlength="50"
              placeholder="Enter ID"
              aria-label="Peer ID to connect to"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              bind:value={newConnectionIdInput}
              class="rounded-lg bg-[#D9D9D9] px-4 py-2.5 font-mono text-sm font-bold outline-hidden outline-2 outline-offset-2 placeholder:text-dark/50 focus:outline-neutral-500 max-md:w-full"
            />

            <button
              type="submit"
              disabled={connecting}
              class="btn-secondary rounded-lg bg-[#555E69] px-4 py-2 text-sm font-medium text-light shadow-none disabled:opacity-60"
              >{connecting ? "Waiting…" : "Connect"}</button
            >
          </form>

          <div
            class="border-b border-neutral-300 p-4 text-left font-mono md:p-5"
          >
            <h3 class="text-sm font-medium text-[#555E69]">
              Select a connection:
            </h3>

            {#if $connectionState.list.length === 0}
              <div class="mt-3 text-xs font-medium text-[#555E69]/70">
                Waiting for connections ...
              </div>
            {:else}
              <div class="mt-3 flex items-center gap-4">
                {#each $connectionState.list as conn}
                  <button
                    class="rounded-md px-4 py-2 text-center text-sm font-semibold {$connectionState.selectedId ===
                    conn
                      ? 'bg-[#555E69] text-light shadow-md'
                      : 'bg-[#555E69]/60 text-light'}"
                    onclick={() => selectConnection(conn)}
                  >
                    {conn}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <P2PChatUi />
        {/if}
      </div>
    </div>
  </div>
</section>

<section
  class="fixed top-0 left-0 z-50 flex h-full w-full items-center justify-center bg-black/50 px-4 py-4"
  class:hidden={!$videoCallDialogOpen}
>
  <div
    role="dialog"
    aria-label="Video call"
    class="relative flex w-fit flex-col gap-4 rounded-xl bg-white p-4 max-md:items-center md:h-[calc(340px+5rem)] md:flex-row"
  >
    <video
      class="rounded-lg bg-neutral-100"
      style="height: {videoWidth}px; width: {videoWidth}px;"
      autoplay
      playsinline
      muted
      width="{videoWidth}px"
      height="{videoWidth}px"
      bind:this={$currentUserVideoRef}
    >
      <track kind="captions" />
    </video>
    <video
      class="rounded-lg bg-neutral-100"
      style="height: {videoWidth}px; width: {videoWidth}px;"
      autoplay
      playsinline
      width="{videoWidth}px"
      height="{videoWidth}px"
      bind:this={$remoteUserVideoRef}
    >
      <track kind="captions" />
    </video>

    <button
      class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 shadow-none hover:bg-red-50 md:absolute md:bottom-3 md:left-1/2 md:-translate-x-1/2"
      onclick={() => endCall()}
      >End Call
    </button>
  </div>
</section>
