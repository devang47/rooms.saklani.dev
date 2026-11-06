<script lang="ts">
  import type { Snippet } from "svelte";
  import Notifications from "#lib/sections/Notifications.svelte";
  import LoadingScreen from "#lib/sections/LoadingScreen.svelte";
  import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
  import { loading } from "#lib/stores/index.ts";
  import "#lib/styles/global.css";

  let { children }: { children: Snippet } = $props();

  const title = "ChatRooms | Private, self-destructing chat rooms";
  const description =
    "Create a private, end-to-end encrypted chat room that deletes itself after 15 minutes, or chat peer-to-peer over WebRTC with file transfer and video calls.";
  const image =
    "https://res.cloudinary.com/dyn3sdtfm/image/upload/v1663470958/og1_l965qv.webp";
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://rooms.saklani.dev" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@devangsaklani" />
  <meta name="twitter:image:alt" content="ChatRooms" />
</svelte:head>

{#if $loading}
  <LoadingScreen />
{/if}

<Notifications />
<ConfirmDialog />

{@render children()}
