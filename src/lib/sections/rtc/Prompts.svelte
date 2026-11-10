<script lang="ts">
  import { easeOut, reduceMotion } from "#utils/motion.ts";
  import { prompts } from "#stores";
  import { fly } from "svelte/transition";
</script>

<div
  class="fixed bottom-6 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-3"
>
  {#each $prompts as prompt (prompt.id)}
    <div
      role="alertdialog"
      aria-label={prompt.text}
      class="rounded-xl bg-light px-4 py-3 text-left font-mono text-sm text-dark shadow-lg ring-1 ring-black/5"
      transition:fly={{
        y: reduceMotion ? 0 : 12,
        duration: 200,
        easing: easeOut,
      }}
    >
      <p class="font-medium">{prompt.text}</p>
      <div class="mt-3 flex gap-2">
        <button
          class="press rounded-lg bg-[#555E69] px-4 py-1.5 text-xs font-bold text-light"
          onclick={() => prompt.answer(true)}>{prompt.accept}</button
        >
        <button
          class="press rounded-lg border border-neutral-300 px-4 py-1.5 text-xs font-bold text-dark hover:bg-neutral-100"
          onclick={() => prompt.answer(false)}>{prompt.decline}</button
        >
      </div>
    </div>
  {/each}
</div>
