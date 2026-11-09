<script lang="ts">
  import { easeOut, reduceMotion } from "#utils/motion.ts";
  import { roomData } from "#stores";
  import Button from "#lib/components/Button.svelte";
  import CircleAnimation from "#lib/components/CircleAnimation.svelte";
  import ArrowRight from "#lib/icons/ArrowRight.svelte";
  import DashedUnderline from "#lib/icons/DashedUnderline.svelte";
  import CurvedArrowLine from "#lib/icons/CurvedArrowLine.svelte";
  import { fly } from "svelte/transition";
  import { goto, preloadCode } from "$app/navigation";
  import { addNotification } from "#utils/notifications.ts";
  import { coverPage } from "#utils/transitions.ts";
  import FloatingImages from "#lib/sections/FloatingImages.svelte";

  let inputVal = $state("");
  let formLoading = $state("false");
  let roomExists = $state(true);
  const joinRoom = async () => {
    if (!inputVal || inputVal.length < 6) return;
    formLoading = "true";

    const { checkIfRoomExists } = await import("#helpers/Room.ts");
    $roomData = await checkIfRoomExists(inputVal);
    if (!$roomData) {
      formLoading = "false";
      roomExists = false;

      addNotification("404 Not found!", true);

      return null;
    }

    roomExists = true;
    formLoading = "complete";

    document
      .querySelectorAll(".moveable-block")
      .forEach((block) =>
        block.animate({ opacity: 0 }, { duration: 100, fill: "forwards" }),
      );

    await document
      .querySelector(".arrow-button")!
      .animate(
        { scale: [1, 100] },
        { duration: 300, easing: "linear", fill: "forwards" },
      ).finished;

    goto("/room/" + inputVal);
  };

  const handleGotoCreatePage = async () => {
    await coverPage();
    goto("/");
  };
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

      <form
        action="#"
        onsubmit={(event) => {
          event.preventDefault();
          joinRoom();
        }}
      >
        <div class="roomid-input">
          <input
            bind:value={inputVal}
            onfocus={() => preloadCode("/room/[id]")}
            class=""
            placeholder="xxxxxx"
            maxlength="6"
            type="text"
            name=""
            id=""
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
              <span
                in:fly|global={{
                  y: reduceMotion ? 0 : 12,
                  duration: 200,
                  easing: easeOut,
                }}
              >
                Not Found
              </span>
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
