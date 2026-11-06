<script lang="ts">
  import { page } from "$app/state";
  import { loading } from "#lib/stores/index.ts";

  loading.set(false);
</script>

<h1 class="pt-20 pb-10 text-center font-sans text-5xl font-bold">
  {page.status}
</h1>
<p class="mb-6 text-center text-gray-600">{page.error?.message}</p>
<a href="/" class="mx-auto block w-fit text-center text-gray-800 underline"
  >home</a
>
