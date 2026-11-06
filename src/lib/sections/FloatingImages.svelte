<script lang="ts">
  // Decorative photos around the hero. They settle in via CSS (global.css) and drift with
  // the mouse on larger screens.
  const cloudinary =
    "https://res.cloudinary.com/dyn3sdtfm/image/upload/c_scale,w_600";
  const blocks = [
    {
      depth: 20,
      src: `${cloudinary}/v1663411910/s-o-c-i-a-l-c-u-t-OjnmCKmzr3A-unsplash_wwntkj.webp`,
      class:
        "left-[-170px] top-[-3rem] h-40! w-60! translate-x-[-80px] sm:top-24 md:left-[-130px] md:w-68 lg:left-[-100px] lg:top-20 lg:w-80!",
    },
    {
      depth: 40,
      src: `${cloudinary}/v1663412785/robert-keane-HFcxrs5u4uE-unsplash_qxzngi.webp`,
      class: "left-[-10rem] top-[60vh] h-40! w-72! translate-x-[-100px]",
    },
    {
      depth: 10,
      src: `${cloudinary}/v1663412879/kobu-agency-k41cAJvJ7h0-unsplash_atqohj.webp`,
      class:
        "right-[-15rem] top-[75vh] h-40! w-40 translate-x-[80px] sm:right-[-12rem] lg:right-[15vw] lg:top-[80vh] lg:h-36! lg:w-72!",
    },
    {
      depth: 40,
      src: `${cloudinary}/v1663411907/engin-akyurt-G26eJNYZA24-unsplash_kffjfa.webp`,
      class:
        "right-[-12rem] top-28 h-60! w-72! translate-x-[100px] lg:right-[-4rem]",
    },
  ];

  let elements: HTMLElement[] = $state([]);

  const parallax = (e: MouseEvent) => {
    if (innerWidth <= 640) return;
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    blocks.forEach(({ depth }, i) => {
      if (elements[i])
        elements[i].style.transform =
          `translate(${depth * x}px, ${depth * y}px)`;
    });
  };
</script>

<svelte:window onmousemove={parallax} />

{#each blocks as block, i}
  <div
    bind:this={elements[i]}
    class="moveable-block hidden sm:block {block.class}"
  >
    <img src={block.src} alt="" decoding="async" fetchpriority="low" />
  </div>
{/each}

<style>
  div {
    position: fixed;
    z-index: 10;
    height: 15rem;
    width: 20rem;
    overflow: hidden;
    border-radius: 30px;
    background: var(--color-dark);
    transition: transform 0.5s ease-out;
    box-shadow:
      0px 109px 92px rgba(0, 0, 0, 0.09),
      0px 45.5376px 38.4354px rgba(0, 0, 0, 0.0646969),
      0px 24.3466px 20.5494px rgba(0, 0, 0, 0.0536497),
      0px 13.6485px 11.5198px rgba(0, 0, 0, 0.045),
      0px 7.24861px 6.11809px rgba(0, 0, 0, 0.0363503),
      0px 3.01631px 2.54588px rgba(0, 0, 0, 0.0253031);
  }

  img {
    height: 100%;
    width: 100%;
    object-fit: cover;
  }
</style>
