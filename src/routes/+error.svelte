<script lang="ts">
  import { page } from "$app/state";
</script>

<h1>{page.status}</h1>

<a href="/"> home </a>

<style lang="postcss">
  h1 {
    @apply pb-10 pt-20 text-center text-5xl font-bold;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
      Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }

  a {
    @apply mx-auto block w-fit text-center text-gray-800 underline;
  }
</style>
