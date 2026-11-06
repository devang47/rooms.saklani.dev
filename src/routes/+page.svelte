<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import Button from "#lib/components/Button.svelte";
  import CircleAnimation from "#lib/components/CircleAnimation.svelte";
  import ArrowRight from "#lib/icons/ArrowRight.svelte";
  import DashedUnderline from "#lib/icons/DashedUnderline.svelte";
  import Github from "#lib/icons/Github.svelte";
  import FloatingImages from "#lib/sections/FloatingImages.svelte";
  import { loading } from "#lib/stores/index.ts";
  import { addNotification } from "#lib/utils/notifications.ts";
  import { coverScreen } from "#lib/utils/motion.ts";

  let formLoading = $state<"false" | "true" | "complete">("false");

  // Firebase is only downloaded once someone heads for "Create a room".
  const loadRoom = () => import("#lib/helpers/Room.ts");

  const handleCreateRoom = async () => {
    formLoading = "true";
    let roomId: string;
    try {
      roomId = await (await loadRoom()).createRoom();
    } catch (err) {
      console.error(err);
      formLoading = "false";
      addNotification("Couldn't create a room, please try again", true);
      return;
    }
    formLoading = "complete";

    await coverScreen();
    $loading = true;
    goto(`/room/${roomId}`);
  };

  const handleGotoJoinPage = async () => {
    await coverScreen();
    goto("/room");
  };

  onMount(() => loading.set(false));
</script>

<FloatingImages />

<div class="transition-join-page"></div>

<section class="homepage">
  <div
    class="relative z-1 mx-auto mb-5 flex h-full min-h-[600px] w-full flex-col items-center justify-center rounded-[30px] px-6 py-20 pb-10 font-mono md:rounded-[40px] md:py-4"
  >
    <div class="content">
      <div class="relative mx-auto w-fit">
        <h1
          class="sans relative text-[40px] font-bold text-white/90 sm:text-[55px] md:text-[70px] lg:text-[80px]"
        >
          ChatRooms
        </h1>
        <span
          class="absolute bottom-1 left-1/2 w-10/12 -translate-x-1/2 md:bottom-1"
          ><DashedUnderline />
        </span>
      </div>

      <p
        class="mx-auto mt-4 max-w-md text-[14px] text-white/70 sm:max-w-lg md:max-w-xl md:text-[16px]"
      >
        On this website, you can create a private chat room and share data
        across multiple devices.
      </p>

      <div
        class="mt-10 flex flex-col items-center justify-center gap-10 text-left font-mono text-white md:flex-row md:gap-6 lg:gap-12"
      >
        <div class="md:h-[340px] md:max-w-[20rem]">
          <h2 class="text-lg font-semibold md:text-xl">
            Traditional Chatrooms
          </h2>
          <ul class="mt-3 space-y-1 text-sm font-medium opacity-80">
            <li>
              <span>✅</span> Uses Firebase to store messages and files
            </li>

            <li>
              <span>✅</span> Connect Multiple devices concurrently
            </li>

            <li><span>✅</span> Messages history</li>

            <li><span>✅</span> Auto delete all data after 15min</li>

            <li><span>✅</span> Messages encrypted in your browser</li>
          </ul>

          <Button
            label="create a room"
            class="relative z-20 mt-5 w-[175px] text-sm md:w-[189px]"
            onclick={handleCreateRoom}
            onpointerenter={loadRoom}
            onfocus={loadRoom}
          >
            {#if formLoading === "true"}
              <CircleAnimation class="w-[80px]" />
            {/if}

            <span class:btn-remove-text={formLoading !== "false"}>
              Create a room
              <ArrowRight />
            </span>
          </Button>

          <div class="join-btn">
            or <button
              aria-label="Join existing room"
              title="Join existing room"
              onclick={handleGotoJoinPage}
              class=""
            >
              Join room
            </button>
          </div>
        </div>
        <div class="opacity-60 md:hidden">
          <svg
            width="296"
            height="2"
            viewBox="0 0 296 2"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line
              x1="-0.00012207"
              y1="1.00061"
              x2="296"
              y2="1.00061"
              stroke="#E2E3E4"
              stroke-width="2"
              stroke-dasharray="11 11"
            />
          </svg>
        </div>
        <div class="opacity-60 max-md:hidden">
          <svg
            height="250"
            viewBox="0 0 2 296"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line
              x1="1"
              y1="296"
              x2="0.999987"
              y2="4.37114e-08"
              stroke="#E2E3E4"
              stroke-width="2"
              stroke-dasharray="11 11"
            />
          </svg>
        </div>
        <div class="md:h-[340px] md:max-w-[20rem]">
          <h2 class="text-lg font-semibold md:text-xl">
            WebRTC based Chatrooms
          </h2>
          <ul class="mt-3 space-y-1 text-sm font-medium opacity-80">
            <li>
              <span>✅</span> Uses WebRTC to transfer messages and files
            </li>

            <li>
              <span>✅</span> Device to device, nothing stored on a server
            </li>

            <li>
              <span>✅</span> No messages history
            </li>

            <li>
              <span>✅</span> End to end encrypted
            </li>

            <li>
              <span>✅</span> File transfers
            </li>

            <li>
              <span>✅</span> Video calls
            </li>
          </ul>

          <!-- A link styled as the button (a <button> inside <a> is invalid HTML). -->
          <a
            href="/p2p"
            class="arrow-button group relative z-20 mt-5 block w-[175px] text-sm md:w-[189px]"
          >
            <span>
              Start server
              <ArrowRight />
            </span>
          </a>
        </div>
      </div>

      <div class="absolute top-4 right-6 w-7 text-sm text-white">
        <a
          href="https://github.com/Devang47/rooms.saklani.dev"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full underline"
        >
          <Github />
        </a>
      </div>
    </div>

    <div class="bg"></div>
  </div>
</section>

<style>
  :global(html) {
    overflow: hidden !important;
  }

  li {
    position: relative;
    padding-left: 1.5rem;
  }

  li span {
    position: absolute;
    left: 0;
  }
</style>
