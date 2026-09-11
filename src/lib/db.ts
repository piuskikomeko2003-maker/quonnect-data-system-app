import Dexie from 'dexie';

export interface Submission {
  id: string;
  token: string;
  form_slug: string;
  edition_id: string;
  data: Record<string, string>;
  status: 'pending' | 'synced';
  created_at: Date;
}

export interface CachedSchema {
  id?: number;
  token: string;
  edition_id: string;
  form_slug: string;
  link_data: unknown;
  edition: unknown;
  questions: unknown[];
  sections: unknown[];
  question_logic: unknown[];
  section_logic: unknown[];
  prefill_defaults?: Record<string, string>;
  cached_at: Date;
}

class OfflineDB extends Dexie {
  submissions!: Dexie.Table<Submission, string>;
  cached_schemas!: Dexie.Table<CachedSchema, number>;

  constructor() {
    super('QuonnectOfflineDB');
    this.version(1).stores({
      submissions: 'id, token, status, created_at',
      cached_schemas: '++id, token',
    });
    this.version(2).stores({
      submissions: 'id, token, status, created_at, [status+token]',
      cached_schemas: '++id, token',
    });
  }
}

export const db = new OfflineDB();

export async function saveSubmission(submission: Submission): Promise<void> {
  await db.submissions.put(submission);
}

export async function getPendingSubmissions(token?: string): Promise<Submission[]> {
  return db.submissions
    .where(token ? { status: 'pending', token } : { status: 'pending' })
    .toArray();
}

export async function getSubmissionCounts(token: string): Promise<{
  pending: number;
  synced: number;
}> {
  const all = await db.submissions.where({ token }).toArray();
  return {
    pending: all.filter((s) => s.status === 'pending').length,
    synced: all.filter((s) => s.status === 'synced').length,
  };
}

export async function markSynced(submissionId: string): Promise<void> {
  await db.submissions.update(submissionId, { status: 'synced' });
}

export async function cacheSchema(
  schema: Omit<CachedSchema, 'id' | 'cached_at'>
): Promise<void> {
  await db.cached_schemas.where({ token: schema.token }).delete();
  await db.cached_schemas.add({ ...schema, cached_at: new Date() });
}

export async function getCachedSchema(
  token: string
): Promise<CachedSchema | undefined> {
  return db.cached_schemas.where({ token }).first();
}
