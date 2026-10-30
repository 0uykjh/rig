import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { DigestRow } from '../src/digest/types.js';

// `runs/` is read-only (AGENTS.md): the real night (2026-10-28) is read as-is. Anything else a
// test needs — an empty night, a night with a bad line — is built in a temp dir instead.
const tmp = mkdtempSync(join(tmpdir(), 'rig-route-tests-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function tempConfig(contents: Record<string, string>): RigConfig {
  const dir = mkdtempSync(join(tmp, 'runs-'));
  for (const [night, text] of Object.entries(contents)) {
    writeFileSync(join(dir, `${night}.jsonl`), text);
  }
  return { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };
}

const realConfig: RigConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

describe('a night that exists (2026-10-28)', () => {
  it('the page answers 200', async () => {
    const res = await createApp(realConfig).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('2026-10-28');
  });

  it('the JSON answers 200', async () => {
    const res = await createApp(realConfig).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
  });
});

describe('a night with no file', () => {
  it('the page answers 404', async () => {
    const res = await createApp(realConfig).request('/digest/1999-01-01');
    expect(res.status).toBe(404);
  });

  it('the JSON answers 404', async () => {
    const res = await createApp(realConfig).request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
  });
});

describe('the empty night', () => {
  const config = tempConfig({ '2026-02-01': '' });

  it('the page renders "nothing ran"', async () => {
    const res = await createApp(config).request('/digest/2026-02-01');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('nothing ran');
  });

  it('the JSON has no rows', async () => {
    const res = await createApp(config).request('/api/digest/2026-02-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: DigestRow[] };
    expect(body.rows).toEqual([]);
  });
});

describe('a night with a bad line', () => {
  const config = tempConfig({
    '2026-02-02': [
      '{"at":"2026-02-02T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
      'not json at all',
      '{"at":"2026-02-02T02:00:00+01:00","job":"a","status":"fail","error":"boom"}',
    ].join('\n'),
  });

  it('the night still renders and the bad line is counted, never thrown', async () => {
    const res = await createApp(config).request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('a');
    expect(html).not.toContain('nothing ran');
  });

  it('the JSON still answers and counts the bad line', async () => {
    const res = await createApp(config).request('/api/digest/2026-02-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]?.job).toBe('a');
  });
});

describe('the page and the JSON agree', () => {
  it('same jobs, same order, for the real night', async () => {
    const app = createApp(realConfig);
    const pageRes = await app.request('/digest/2026-10-28');
    const jsonRes = await app.request('/api/digest/2026-10-28');
    const html = await pageRes.text();
    const body = (await jsonRes.json()) as { rows: DigestRow[] };

    const jobsFromJson = body.rows.map((r) => r.job);
    expect(jobsFromJson).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);

    // The page lists the same jobs in the same order it appears in the JSON.
    let cursor = 0;
    for (const job of jobsFromJson) {
      const at = html.indexOf(job, cursor);
      expect(at).toBeGreaterThanOrEqual(0);
      cursor = at + job.length;
    }
  });
});
