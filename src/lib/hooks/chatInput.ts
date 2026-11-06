const isDesktop = () => window.innerWidth >= 640;

/**
 * Chat textarea behaviour (desktop only): Enter sends, Shift+Enter is a native newline,
 * IME composition is left alone, and "/" anywhere outside a field focuses the input.
 */
export function chatInput(node: HTMLTextAreaElement, send: () => void) {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && isDesktop()) {
      e.preventDefault();
      send();
    }
  };
  const onWindowKeydown = (e: KeyboardEvent) => {
    const target = e.target as Element | null;
    if (
      e.key === "/" &&
      isDesktop() &&
      !target?.closest?.("input, textarea, select, [contenteditable]")
    ) {
      e.preventDefault();
      node.focus();
    }
  };

  node.addEventListener("keydown", onKeydown);
  window.addEventListener("keydown", onWindowKeydown);

  return {
    update(newSend: () => void) {
      send = newSend;
    },
    destroy() {
      node.removeEventListener("keydown", onKeydown);
      window.removeEventListener("keydown", onWindowKeydown);
    },
  };
}
