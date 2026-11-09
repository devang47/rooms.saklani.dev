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
  <meta property="og:url" content="https://rooms.saklani.dev" />
  <meta property="og:image" content="https://rooms.saklani.dev/og.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta
    property="og:image:alt"
    content="The ChatRooms home page, offering Firebase rooms and peer-to-peer rooms"
  />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@devangsaklani" />
  <meta name="twitter:title" content="Chat Rooms | Devang Saklani" />
  <meta
    name="twitter:description"
    content="At rooms.saklani.dev you can create a private chat room and share data across multiple devices, the chat room will automatically delete after 15min."
  />
  <meta name="twitter:image" content="https://rooms.saklani.dev/og.jpg" />
  <meta
    name="twitter:image:alt"
    content="The ChatRooms home page, offering Firebase rooms and peer-to-peer rooms"
  />
</svelte:head>
