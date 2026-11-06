<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    error = false,
    label,
    type = "button",
    class: className = "",
    children,
    ...rest
  }: HTMLButtonAttributes & {
    error?: boolean;
    label: string;
    children?: Snippet;
  } = $props();
</script>

<button
  {...rest}
  {type}
  aria-label={label}
  class={["arrow-button group", className, { error }]}
>
  {@render children?.()}
</button>
