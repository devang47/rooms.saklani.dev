<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { loading, roomData } from "#lib/stores/index.ts";
  import Button from "#lib/components/Button.svelte";
  import CircleAnimation from "#lib/components/CircleAnimation.svelte";
  import ArrowRight from "#lib/icons/ArrowRight.svelte";
  import DashedUnderline from "#lib/icons/DashedUnderline.svelte";
  import CurvedArrowLine from "#lib/icons/CurvedArrowLine.svelte";
  import FloatingImages from "#lib/sections/FloatingImages.svelte";
  import { addNotification } from "#lib/utils/notifications.ts";
  import { coverScreen, expandButton } from "#lib/utils/motion.ts";

  let inputVal = $state("");
  let formLoading = $state<"false" | "true" | "complete">("false");
  let roomExists = $state(true);

  // Firebase is only downloaded once the user starts typing a code.
  const loadRoom = () => import("#lib/helpers/Room.ts");

  const joinRoom = async (e: SubmitEvent) => {
    e.preventDefault();
    const code = inputVal.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      addNotification("Room codes are 6 letters or digits", true);
      return;
    }
    formLoading = "true";

    try {
      $roomData = await (await loadRoom()).checkIfRoomExists(code);
    } catch {
      formLoading = "false";
      addNotification("Couldn't reach the server, please try again", true);
      return;
    }
    if (!$roomData) {
      formLoading = "false";
      roomExists = false;
      addNotification("404 Not found!", true);
      return;
    }

    roomExists = true;
    formLoading = "complete";
    await expandButton(document.querySelector(".join-room-page .arrow-button"));
    goto("/room/" + code);
  };

  const handleGotoCreatePage = async () => {
    await coverScreen();
    goto("/");
  };

  onMount(() => loading.set(false));
</script>

<FloatingImages />

<div class="transition-join-page"></div>

<section class="join-room-page">
  <div class="container">
    <div class="content">
      <div class="relative mx-auto w-fit">
        <h1 class="sans">Join Room</h1>
        <span
          class="absolute bottom-1 left-1/2 w-10/12 -translate-x-1/2 md:bottom-1"
          ><DashedUnderline />
        </span>
      </div>

      <form onsubmit={joinRoom}>
        <div class="roomid-input">
          <input
            bind:value={inputVal}
            onfocus={loadRoom}
            class=""
            placeholder="xxxxxx"
            maxlength="6"
            type="text"
            aria-label="Room code"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <span class="curved-arrow-line">
            <CurvedArrowLine />
          </span>
        </div>

        <div class="group relative mx-auto w-fit">
          <Button
            label="Join room"
            type="submit"
            error={!roomExists}
            class="arrow-button"
          >
            {#if formLoading === "true"}
              <CircleAnimation class="w-[80px]" />
            {:else if !roomExists}
              <span in:fly={{ y: 12 }}> Not Found </span>
            {/if}

            <span
              class:btn-remove-text={formLoading !== "false" || !roomExists}
            >
              Join <ArrowRight />
            </span>
          </Button>

          <div class="create-btn">
            or <button
              aria-label="create a new room"
              type="button"
              title="Create room"
              onclick={handleGotoCreatePage}
              class=""
            >
              Create room
            </button>
          </div>
        </div>
      </form>
    </div>

    <div class="bg"></div>
  </div>
</section>
