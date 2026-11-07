<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  interface Props extends HTMLButtonAttributes {
    error?: boolean;
    label?: string;
  }

  let {
    error = false,
    type = "button",
    label = "default label",
    class: className = "",
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {onclick}
  aria-label={label}
  class:error
  {type}
  class={`arrow-button group shadow-custom ${className}`}
>
  {@render children?.()}
</button>
