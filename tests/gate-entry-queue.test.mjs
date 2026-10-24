// Unit tests for the durable gate-entry write queue.
//
//   npm run test:gate-entry
//
// The queue is framework-free on purpose, so it can be exercised in plain Node
// with the same TypeScript loader the sticker verification script uses.

import test from 'node:test';
import assert from 'node:assert/strict';
import { GateEntryQueue, defaultIsPermanentError } from '../src/lib/gateEntryQueue.ts';

const KEY = 'quonnect.gate-entry.v1';

function memoryStorage(initial) {
  const map = new Map();
  if (initial !== undefined) map.set(KEY, initial);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

function makeQueue(overrides = {}) {
  return new GateEntryQueue({
    storage: null,
    baseDelayMs: 1,
    maxDelayMs: 5,
    random: () => 0,
    write: async () => {},
    ...overrides,
  });
}

async function waitFor(predicate, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

test('coalesces rapid same-vendor taps into the last desired value', async () => {
  const writes = [];
  const queue = makeQueue({
    write: async (id, value) => {
      writes.push([id, value]);
    },
  });

  queue.set('vendor-1', '2026-10-24T10:00:00.000Z');
  queue.set('vendor-1', '2026-10-24T10:00:01.000Z');

  await waitFor(() => queue.getSnapshot().pendingCount === 0);

  assert.deepEqual(writes, [['vendor-1', '2026-10-24T10:00:01.000Z']]);
  queue.dispose();
});

test('retries transient failures with backoff instead of dropping the mark', async () => {
  let attempts = 0;
  const queue = makeQueue({
    write: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('Failed to fetch');
    },
  });

  queue.set('vendor-1', '2026-10-24T10:00:00.000Z');
  await waitFor(() => queue.getSnapshot().pendingCount === 0);

  assert.equal(attempts, 3);
  queue.dispose();
});

test('a newer tap supersedes an in-flight write and is sent afterwards', async () => {
  const resolvers = [];
  const queue = makeQueue({
    write: (id, value) =>
      new Promise((resolve) => {
        resolvers.push({ id, value, resolve });
      }),
  });

  queue.set('vendor-1', 'T1');
  await waitFor(() => resolvers.length === 1);

  queue.set('vendor-1', null);
  resolvers[0].resolve();
  await waitFor(() => resolvers.length === 2);

  assert.equal(resolvers[1].value, null);
  resolvers[1].resolve();
  await waitFor(() => queue.getSnapshot().pendingCount === 0);
  queue.dispose();
});

test('serializes writes for the same vendor and respects concurrency across vendors', async () => {
  const resolvers = [];
  let active = 0;
  let maxActive = 0;
  const queue = makeQueue({
    concurrency: 1,
    write: (id, value) =>
      new Promise((resolve) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        resolvers.push({ id, value, resolve: () => {
          active -= 1;
          resolve();
        } });
      }),
  });

  queue.set('vendor-1', 'T1');
  queue.set('vendor-2', 'T2');

  await waitFor(() => resolvers.length === 1);
  assert.equal(resolvers.length, 1, 'second vendor waits for the single slot');

  resolvers[0].resolve();
  await waitFor(() => resolvers.length === 2);
  resolvers[1].resolve();
  await waitFor(() => queue.getSnapshot().pendingCount === 0);

  assert.equal(maxActive, 1);
  queue.dispose();
});

test('permanent failures are removed and reported, not retried forever', async () => {
  const denied = Object.assign(new Error('permission denied'), { status: 403 });
  let reported = null;
  let attempts = 0;

  const queue = makeQueue({
    write: async () => {
      attempts += 1;
      throw denied;
    },
    onPermanentError: (id, value, error) => {
      reported = { id, value, error };
    },
  });

  queue.set('vendor-1', 'T1');
  await waitFor(() => reported !== null);

  assert.equal(reported.id, 'vendor-1');
  assert.equal(reported.error, denied);
  assert.equal(queue.getSnapshot().pendingCount, 0);
  assert.equal(attempts, 1);
  queue.dispose();
});

test('hydrates persisted marks from a previous session and replays them', async () => {
  const storage = memoryStorage();

  // A mark captured while the write hangs (e.g. tab closed mid-request).
  const first = makeQueue({
    storage,
    write: () => new Promise(() => {}),
  });
  first.set('vendor-1', '2026-10-24T10:00:00.000Z');
  first.dispose();

  const writes = [];
  const replay = makeQueue({
    storage,
    write: async (id, value) => {
      writes.push([id, value]);
    },
  });

  assert.equal(replay.getSnapshot().pendingCount, 1);
  await replay.retryNow();

  assert.deepEqual(writes, [['vendor-1', '2026-10-24T10:00:00.000Z']]);
  assert.equal(replay.getSnapshot().pendingCount, 0);
  assert.equal(storage.getItem(KEY), null, 'storage is cleared once settled');
  replay.dispose();
});

test('classifies auth/network errors as retryable and permission errors as permanent', () => {
  assert.equal(defaultIsPermanentError(Object.assign(new Error('x'), { status: 403 })), true);
  assert.equal(defaultIsPermanentError(Object.assign(new Error('x'), { status: 401 })), false);
  assert.equal(defaultIsPermanentError(Object.assign(new Error('x'), { status: 429 })), false);
  assert.equal(defaultIsPermanentError(new TypeError('Failed to fetch')), false);
  assert.equal(defaultIsPermanentError({ code: '42501' }), true);
  assert.equal(defaultIsPermanentError({ code: 'PGRST301' }), false);
});
