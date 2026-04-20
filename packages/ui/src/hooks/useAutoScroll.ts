import { useEffect, useRef } from 'react';

/**
 * Auto-scrolls a container to the bottom when new items arrive,
 * but only if the user is already near the bottom (within threshold).
 */
export function useAutoScroll<TContainer extends HTMLElement, TItem extends HTMLElement = HTMLElement>(itemCount: number, threshold = 120) {
  const scrollRef = useRef<TContainer>(null);
  const bottomRef = useRef<TItem>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [itemCount, threshold]);

  return { scrollRef, bottomRef };
}
