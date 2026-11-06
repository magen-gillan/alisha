let generation = 0;
const activeControllers = new Set<AbortController>();

export interface ChatRequestHandle {
  id: number;
  controller: AbortController;
  isCurrent: () => boolean;
  finish: () => void;
}

/** Starting a chat request cancels older voice or text requests globally. */
export function beginChatRequest(): ChatRequestHandle {
  cancelChatRequests();
  const id = generation;
  const controller = new AbortController();
  activeControllers.add(controller);
  return {
    id,
    controller,
    isCurrent: () => id === generation && !controller.signal.aborted,
    finish: () => activeControllers.delete(controller),
  };
}

/** Invalidates pending responses before they can start a new utterance. */
export function cancelChatRequests(): void {
  generation += 1;
  for (const controller of activeControllers) controller.abort();
  activeControllers.clear();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('alisha:chat-cancelled'));
}
