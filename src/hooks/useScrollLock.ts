import { useEffect } from 'react';

let lockCount = 0;
let previous: Array<{ el: HTMLElement; overflow: string }> = [];

function getScrollTargets(): HTMLElement[] {
  const els: Array<HTMLElement | null> = [
    document.body,
    document.documentElement,
    document.getElementById('app-scroll'),
  ];
  return els.filter((el): el is HTMLElement => el !== null);
}

function lock() {
  if (lockCount === 0) {
    previous = getScrollTargets().map((el) => ({ el, overflow: el.style.overflow }));
    previous.forEach(({ el }) => {
      el.style.overflow = 'hidden';
    });
  }
  lockCount += 1;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    previous.forEach(({ el, overflow }) => {
      el.style.overflow = overflow;
    });
    previous = [];
  }
}

/**
 * Locks page scrolling while a modal/overlay is open.
 * Targets the document plus the app's internal scroll container (#app-scroll)
 * so the dashboard cannot scroll behind overlays. Reference-counted so
 * stacked modals do not unlock each other prematurely.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return () => unlock();
  }, [active]);
}
