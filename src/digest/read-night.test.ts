import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from './read-night.js';
import type { DigestRow } from './types.js';

// The real nights are read-only fixtures (AGENTS.md): read them, never write them. Anything a
// test needs that isn't on disk goes in a temp dir.
const RUNS = fileURLToPath(new URL('../../runs', import.meta.url));

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function tempNight(night: string, contents: string): string {
  writeFileSync(join(tmp, `${night}.jsonl`), contents);
  return tmp;
}

function row(night: { rows: DigestRow[] }, job: string): DigestRow {
  const found = night.rows.find((r) => r.job === job);
  if (found === undefined) throw new Error(`no row for ${job}`);
  return found;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight(RUNS, '2026-10-28');

  it('reads 5 jobs and counts the 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('keeps the row when the owner is null', () => {
    expect(row(night!, 'digest/render').owner).toBeNull();
    expect(row(night!, 'digest/render').runs).toBe(1);
  });

  it('counts runs and only the retries', () => {
    const fixtures = row(night!, 'fixtures/refresh');
    expect(fixtures.runs).toBe(4);
    expect(fixtures.retries).toBe(3);

    const sync = row(night!, 'lane/sync');
    expect(sync.runs).toBe(8);
    expect(sync.retries).toBe(1);
    expect(row(night!, 'rig/rotate-logs').retries).toBe(0);
  });

  it('takes last status and last error from the job last line', () => {
    expect(row(night!, 'fixtures/refresh').lastStatus).toBe('ok');
    expect(row(night!, 'fixtures/refresh').lastError).toBeNull();

    const backup = row(night!, 'notes/backup');
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
    expect(backup.owner).toBe('lane-07');
  });

  it('keeps the offset from the log, never UTC', () => {
    const sync = row(night!, 'lane/sync');
    expect(sync.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync.lastAt).toBe('2026-10-29T05:00:04+01:00');
    for (const r of night!.rows) {
      expect(r.firstAt).toMatch(/\+01:00$/);
      expect(r.lastAt).toMatch(/\+01:00$/);
    }
  });
});

describe('readNight edge cases', () => {
  it('returns null when the night has no file', () => {
    expect(readNight(RUNS, '1999-01-01')).toBeNull();
    expect(readNight('no/such/dir', '2026-10-28')).toBeNull();
    expect(readNight(RUNS, '../runs/2026-10-28')).toBeNull();
  });

  it('reads an empty file as a night with no rows, not as a missing night', () => {
    const dir = tempNight('2026-01-01', '');
    const night = readNight(dir, '2026-01-01');
    expect(night).not.toBeNull();
    expect(night?.rows).toEqual([]);
    expect(night?.badLines).toBe(0);
  });

  it('counts every unparsable line and still renders the good ones', () => {
    const dir = tempNight(
      '2026-01-02',
      [
        '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok","owner":"rook"}',
        'not json at all',
        '{"at":"2026-01-02T02:00:00+02:00","job":"a","status":',
        '{"at":"2026-01-02T03:00:00+02:00","job":"a","status":"sideways","owner":"rook"}',
        '{"job":"a","status":"ok"}',
        '["at","job"]',
        '',
        '{"at":"2026-01-02T04:00:00+02:00","job":"a","status":"fail","error":"boom"}',
        '',
      ].join('\n'),
    );
    const night = readNight(dir, '2026-01-02');
    expect(night?.badLines).toBe(5);
    expect(night?.rows).toHaveLength(1);

    const a = row(night!, 'a');
    expect(a.runs).toBe(2);
    expect(a.lastStatus).toBe('fail');
    expect(a.lastError).toBe('boom');
    expect(a.firstAt).toBe('2026-01-02T01:00:00+02:00');
    expect(a.lastAt).toBe('2026-01-02T04:00:00+02:00');
    // The last line forgot the owner; the job keeps the one it had.
    expect(a.owner).toBe('rook');
  });

  it('keeps a job whose every line is ownerless', () => {
    const dir = tempNight(
      '2026-01-03',
      '{"at":"2026-01-03T01:00:00-05:00","job":"b","status":"retry","owner":null,"error":"flaky"}\n',
    );
    const night = readNight(dir, '2026-01-03');
    expect(night?.rows).toEqual([
      {
        job: 'b',
        owner: null,
        runs: 1,
        retries: 1,
        lastStatus: 'retry',
        lastError: 'flaky',
        firstAt: '2026-01-03T01:00:00-05:00',
        lastAt: '2026-01-03T01:00:00-05:00',
      },
    ]);
  });
});
