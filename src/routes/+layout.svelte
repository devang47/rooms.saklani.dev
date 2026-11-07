<script lang="ts">
  import Notifications from "#lib/sections/Notifications.svelte";
  import LoadingScreen from "#lib/sections/LoadingScreen.svelte";
  import { loading } from "#stores";
  import "@fontsource-variable/jetbrains-mono/wght.css";
  import jetbrainsMono from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
  import "#styles/global.scss";
  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();
</script>

{#if $loading}
  <LoadingScreen />
{/if}

<Notifications />

{@render children?.()}

<svelte:head>
  <link
    rel="preload"
    href={jetbrainsMono}
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
  />

  <title>Chat Rooms | Devang Saklani</title>
  <meta
    name="description"
    content="At rooms.saklani.dev you can create a private chat room and share data across multiple devices, the chat room will automatically delete after 15min.."
  />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="Chat Rooms | Devang Saklani" />
  <meta
    property="og:description"
    content="At rooms.saklani.dev you can create a private chat room and share data across multiple devices, the chat room will automatically delete after 15min."
  />
  <meta property="og:url" content="https://saklani.dev" />
  <meta
    property="og:image"
    content="https://res.cloudinary.com/dyn3sdtfm/image/upload/v1663470958/og1_l965qv.webp"
  />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@devangsaklani" />
  <meta name="twitter:title" content="Devang Saklani | Software Engineer" />
  <meta
    name="twitter:description"
    content="At rooms.saklani.dev you can create a private chat room and share data across multiple devices, the chat room will automatically delete after 15min."
  />
  <meta
    name="twitter:image"
    content="https://res.cloudinary.com/dyn3sdtfm/image/upload/v1663470958/og1_l965qv.webp"
  />
  <meta name="twitter:image:alt" content="Devang Saklani | Software Engineer" />
</svelte:head>
