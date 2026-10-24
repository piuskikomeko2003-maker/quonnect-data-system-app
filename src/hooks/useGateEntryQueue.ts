'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  GateEntryQueue,
  type GateEntrySnapshot,
  type GateEntryValue,
} from '@/lib/gateEntryQueue';

interface UseGateEntryQueueOptions {
  /**
   * Only start replaying/writing once auth is ready. Marks captured before
   * sign-in stay persisted instead of failing against an anonymous session.
   */
  enabled?: boolean;
  onSettled?: (id: string, value: GateEntryValue) => void;
  onPermanentError?: (id: string, value: GateEntryValue, error: unknown) => void;
}

interface UseGateEntryQueueResult {
  snapshot: GateEntrySnapshot;
  pendingCount: number;
  syncing: boolean;
  hasPending: (id: string) => boolean;
  /** Record the absolute desired check-in value; never toggles internally. */
  setEntry: (id: string, value: GateEntryValue) => void;
  retryNow: () => void;
}

const EMPTY_SNAPSHOT: GateEntrySnapshot = { pendingCount: 0, syncing: false };

/**
 * Reads/writes the durable gate-entry queue for the dashboard.
 *
 * The caller owns optimistic UI state; this hook owns delivery. Writes retry
 * forever on transient failures and replay after reload, so a mark tapped at
 * the gate is never lost because the network blinked.
 */
export function useGateEntryQueue(
  options: UseGateEntryQueueOptions = {}
): UseGateEntryQueueResult {
  const { enabled = true } = options;

  const [queue] = useState(
    () =>
      new GateEntryQueue({
        storageKey: 'quonnect.gate-entry.v1',
        write: async (id, value) => {
          const supabase = createClient();
          // `.select().single()` makes "0 rows updated" (e.g. RLS blocked the
          // write) an explicit error instead of a silent no-op.
          const { data, error } = await supabase
            .from('vendor_registrations')
            .update({ check_in_time: value })
            .eq('id', id)
            .select('id, check_in_time')
            .single();

          if (error) throw error;
          if (!data) throw new Error('Entry update was not applied');
        },
      })
  );

  // Keep the queue's settlement callbacks in sync with the latest render
  // without recreating it (which would abandon in-flight marks).
  useEffect(() => {
    queue.configure({
      onSettled: options.onSettled,
      onPermanentError: options.onPermanentError,
    });
  });

  const snapshot = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    () => EMPTY_SNAPSHOT
  );

  useEffect(() => {
    if (!enabled) return;

    const resume = () => {
      void queue.retryNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resume();
    };

    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', onVisibility);
    // Safety net for a stuck socket: retry due work periodically.
    const interval = window.setInterval(resume, 20_000);

    // Replay anything persisted from a previous tab/session.
    resume();

    return () => {
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [enabled, queue]);

  const hasPending = useCallback((id: string) => queue.has(id), [queue]);
  const setEntry = useCallback(
    (id: string, value: GateEntryValue) => queue.set(id, value),
    [queue]
  );
  const retryNow = useCallback(() => {
    void queue.retryNow();
  }, [queue]);

  return {
    snapshot,
    pendingCount: snapshot.pendingCount,
    syncing: snapshot.syncing,
    hasPending,
    setEntry,
    retryNow,
  };
}
