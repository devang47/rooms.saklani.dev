<script lang="ts">
  import { onMount } from "svelte";

  let x = $state(0);
  let y = $state(0);

  onMount(() => {
    // The images are hidden on small screens, and touch has no pointer to follow.
    if (!matchMedia("(hover: hover) and (min-width: 641px)").matches) return;

    const follow = (event: MouseEvent) => {
      x = event.clientX / innerWidth - 0.5;
      y = event.clientY / innerHeight - 0.5;
    };
    window.addEventListener("mousemove", follow, { passive: true });
    return () => window.removeEventListener("mousemove", follow);
  });
</script>

<div class="contents" style:--x={x} style:--y={y}>
  <div
    class="moveable-block hidden sm:block block-0 left-[-170px] top-[-3rem] !h-[10rem] !w-[15rem] translate-x-[-80px] sm:top-[6rem] md:left-[-130px] md:w-[17rem] lg:left-[-100px] lg:top-20 lg:!w-[20rem]"
    style:--depth="20px"
  >
    <img src="/images/float-0.webp" alt="" loading="lazy" decoding="async" />
  </div>

  <div
    class="moveable-block hidden sm:block block-1 left-[-10rem] top-[60vh] !h-[10rem] !w-[18rem] translate-x-[-100px]"
    style:--depth="40px"
  >
    <img src="/images/float-1.webp" alt="" loading="lazy" decoding="async" />
  </div>

  <div
    class="moveable-block hidden sm:block block-2 right-[-15rem] top-[75vh] !h-[10rem] w-[10rem] translate-x-[80px] sm:right-[-12rem] lg:right-[15vw] lg:top-[80vh] lg:!h-[9rem] lg:!w-[18rem]"
    style:--depth="10px"
  >
    <img src="/images/float-2.webp" alt="" loading="lazy" decoding="async" />
  </div>

  <div
    class="moveable-block hidden sm:block block-3 right-[-12rem] top-28 !h-[15rem] !w-[18rem] translate-x-[100px] lg:right-[-4rem]"
    style:--depth="40px"
  >
    <img src="/images/float-3.webp" alt="" loading="lazy" decoding="async" />
  </div>
</div>

<style lang="postcss">
  .moveable-block {
    @apply fixed z-10 h-60 w-80 overflow-hidden rounded-[30px] bg-dark;
    translate: calc(var(--x) * var(--depth)) calc(var(--y) * var(--depth));
    transition: translate 0.5s ease-out;
    animation: settle 0.3s ease-out 0.1s both;
    box-shadow:
      0px 109px 92px rgba(0, 0, 0, 0.09),
      0px 45.5376px 38.4354px rgba(0, 0, 0, 0.0646969),
      0px 24.3466px 20.5494px rgba(0, 0, 0, 0.0536497),
      0px 13.6485px 11.5198px rgba(0, 0, 0, 0.045),
      0px 7.24861px 6.11809px rgba(0, 0, 0, 0.0363503),
      0px 3.01631px 2.54588px rgba(0, 0, 0, 0.0253031);
  }

  img {
    @apply h-full w-full object-cover;
  }

  @keyframes settle {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .moveable-block {
      animation-duration: 1ms;
      animation-delay: 0s;
      transition: none;
    }
  }
</style>
