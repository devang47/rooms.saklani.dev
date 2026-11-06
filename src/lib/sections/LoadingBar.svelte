<script lang="ts">
  let { progress }: { progress: number } = $props();
</script>

<div
  class="h-1 w-96 max-w-[80vw] bg-gray-200"
  role="progressbar"
  aria-valuenow={Math.round(progress)}
>
  <!-- Never below 30% so the bar is visible from the start. -->
  <div
    class="h-full bg-gray-600 transition-[width] duration-300"
    style:width="{Math.max(progress, 30)}%"
  ></div>
</div>
