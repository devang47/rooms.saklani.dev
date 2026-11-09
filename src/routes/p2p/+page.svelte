<script lang="ts">
  import {
    connectionState,
    currentUserVideoRef,
    videoCallDialogOpen,
    remoteUserVideoRef,
  } from "#stores";
  import { addNotification } from "#utils/notifications.ts";
  import ChatHeaderWebrtc from "#lib/sections/ChatHeaderWebrtc.svelte";
  import { connectPeer, selectConnection } from "#helpers/peer/actions.ts";
  import StartServerScreen from "#lib/sections/rtc/StartServerScreen.svelte";
  import P2PChatUi from "#lib/sections/rtc/P2PChatUI.svelte";
  import {
    closeCall,
    PeerConnection,
    sendSystemMessage,
    toggleTrack,
  } from "#helpers/peer/index.ts";
  import { startPeer } from "#helpers/peer/peerActions.ts";
  import Prompts from "#lib/sections/rtc/Prompts.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  let newConnectionIdInput = $state("");

  const handleStartVideoCall = (peerId: string) => {
    $videoCallDialogOpen = true;
    PeerConnection.callPeer(peerId);
  };

  const handleCloseVideoCall = () => {
    closeCall();
    sendSystemMessage("Call ended");
  };

  const handleConnectOtherPeer = async () => {
    if (newConnectionIdInput.trim() !== "") {
      if (newConnectionIdInput !== $connectionState.id) {
        await connectPeer(newConnectionIdInput.toLowerCase());
        newConnectionIdInput = "";
      } else {
        addNotification("Cannot connect to self", true);
      }
    } else addNotification("Please enter a valid ID", true);
  };

  let micOn = $state(true);
  let cameraOn = $state(true);

  $effect(() => {
    if (!$videoCallDialogOpen) micOn = cameraOn = true;
  });

  // An invite link (/p2p?connect=<id>) starts a session and connects to it.
  onMount(async () => {
    const target = new URL(location.href).searchParams.get("connect");
    if (!target) return;
    goto("/p2p", { replace: true, reset: false });

    if (!$connectionState.started) await startPeer();
    if ($connectionState.started && target !== $connectionState.id) {
      await connectPeer(target.toLowerCase());
    }
  });

  let innerWidth = $state(0);

  $effect(() => {
    if (!$connectionState.id) newConnectionIdInput = "";
  });
  let videoWidth = $derived(
    innerWidth > 768 ? 340 : innerWidth > 400 ? 300 : 250,
  );
</script>

<svelte:window bind:innerWidth />

<section class="chat-ui !h-fit min-h-screen !py-20">
  <div class="container !h-fit !rounded-xl">
    <ChatHeaderWebrtc />

    <div class="grid h-full md:p-6">
      <div class="rounded-xl border-neutral-300 md:border">
        {#if !$connectionState.started}
          <StartServerScreen />
        {:else}
          <div
            class="flex items-center gap-4 border-b border-neutral-300 p-4 md:gap-5 md:p-5"
          >
            <input
              type="text"
              maxlength="50"
              placeholder="Enter ID"
              bind:value={newConnectionIdInput}
              class="rounded-lg bg-[#D9D9D9] px-4 py-2.5 font-mono text-sm font-bold outline-none outline-2 outline-offset-2 placeholder:text-[#38404A]/50 focus:outline-neutral-500 max-md:w-full"
            />

            <button
              class="btn-secondary rounded-lg bg-[#555E69] px-4 py-2 text-sm font-medium text-light shadow-none"
              onclick={handleConnectOtherPeer}>Connect</button
            >
          </div>

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

          {#if $connectionState.started}
            <P2PChatUi handleCallPeer={handleStartVideoCall} />
          {/if}
        {/if}
      </div>
    </div>
  </div>
</section>

<section
  class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50 px-4 py-4"
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
      muted
      playsinline
      width="{videoWidth}px"
      height="{videoWidth}px"
      bind:this={$currentUserVideoRef}
      src=""
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
      src=""
    >
      <track kind="captions" />
    </video>

    <div
      class="flex gap-2 md:absolute md:bottom-3 md:left-1/2 md:-translate-x-1/2"
    >
      <button
        class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-dark shadow-none hover:bg-neutral-50"
        aria-pressed={!micOn}
        onclick={() => (micOn = toggleTrack("audio"))}
        >{micOn ? "Mute" : "Unmute"}</button
      >
      <button
        class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-dark shadow-none hover:bg-neutral-50"
        aria-pressed={!cameraOn}
        onclick={() => (cameraOn = toggleTrack("video"))}
        >{cameraOn ? "Camera off" : "Camera on"}</button
      >
      <button
        class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 shadow-none hover:bg-red-50"
        onclick={handleCloseVideoCall}>End call</button
      >
    </div>
  </div>
</section>

<Prompts />
