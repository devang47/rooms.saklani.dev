<script lang="ts">
  import { answerFile } from "#helpers/peer/files.ts";
  import { scale } from "svelte/transition";

  let { transfer }: { transfer: Transfer } = $props();

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const percent = $derived(Math.round(transfer.progress * 100));
  const status = $derived.by(() => {
    switch (transfer.state) {
      case "waiting":
        return "Waiting for them to accept";
      case "offered":
        return "Wants to send you this file";
      case "transferring":
        return `${transfer.outgoing ? "Sending" : "Receiving"} ${percent}%`;
      case "done":
        return transfer.outgoing ? "Sent" : "Received";
      case "declined":
        return "Declined";
      default:
        return "Failed";
    }
  });
</script>

<div
  class="message-item"
  class:right-aligned={transfer.outgoing}
  class:left-aligned={!transfer.outgoing}
  role="group"
  aria-label="File {transfer.name}"
  transition:scale|global={{ start: 0.9, opacity: 0.8 }}
>
  <p class="w-full break-all font-medium">{transfer.name}</p>
  <p class="mt-1 text-xs opacity-60" aria-live="polite">
    {formatSize(transfer.size)} · {status}
  </p>

  {#if transfer.state === "transferring"}
    <div
      class="mt-3 h-1 w-full overflow-hidden rounded bg-black/10"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        class="h-full bg-current transition-[width] duration-150"
        style:width="{percent}%"
      ></div>
    </div>
  {/if}

  {#if transfer.state === "offered"}
    <div class="mt-3 flex gap-2">
      <button
        class="rounded-lg bg-[#555E69] px-4 py-1.5 text-xs font-bold text-light"
        onclick={() => answerFile(transfer.id, true)}>Accept</button
      >
      <button
        class="rounded-lg border border-neutral-300 px-4 py-1.5 text-xs font-bold hover:bg-neutral-100"
        onclick={() => answerFile(transfer.id, false)}>Decline</button
      >
    </div>
  {/if}

  {#if transfer.url}
    <a
      class="mt-2 inline-block text-xs font-bold"
      href={transfer.url}
      download={transfer.name}>Save again</a
    >
  {/if}
</div>
