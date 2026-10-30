import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

// A night is a date on disk: runs/<YYYY-MM-DD>.jsonl. Anything else is not a night, so it has
// no file — and a `night` off a route never walks out of runsDir.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function isRunStatus(value: unknown): value is RunStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

// Parse at the edge (styleguide): one line of JSONL into a RunLine, or null when the line is
// not one. Callers count the nulls; nothing here throws, so one bad line can't lose the night.
export function parseRunLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isRunStatus(status)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;

  // `at` is kept exactly as written: the log's offset is the reader's local time (styleguide).
  const parsed: RunLine = { at, job, status, owner: typeof owner === 'string' ? owner : null };
  return error === undefined ? parsed : { ...parsed, error };
}

function startRow(line: RunLine): DigestRow {
  return {
    job: line.job,
    owner: line.owner,
    runs: 0,
    retries: 0,
    lastStatus: line.status,
    lastError: null,
    firstAt: line.at,
    lastAt: line.at,
  };
}

function addLine(row: DigestRow, line: RunLine): void {
  row.runs += 1;
  if (line.status === 'retry') row.retries += 1;
  // The job's owner, not the line's: a line that forgot the owner doesn't orphan the job.
  if (line.owner !== null) row.owner = line.owner;
  // Last line wins for how the job ended; the file's order is the night's order.
  row.lastStatus = line.status;
  row.lastError = line.error ?? null;
  row.lastAt = line.at;
}

// Reads runs/<night>.jsonl into one DigestRow per job, sorted by job. Null when that night has
// no file (the page's 404). A file with no lines is a Night with no rows: "nothing ran".
export const readNight: ReadNight = (runsDir: string, night: string): Night | null => {
  if (!NIGHT.test(night)) return null;

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue; // blank lines are spacing, not records
    const run = parseRunLine(line);
    if (run === null) {
      badLines += 1;
      continue;
    }
    const row = rows.get(run.job) ?? startRow(run);
    addLine(row, run);
    rows.set(run.job, row);
  }

  return {
    night,
    rows: [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0)),
    badLines,
  };
};
