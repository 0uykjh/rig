import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import type { Night } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

// A night's rows, tallied by how each job last ended. Null means the night couldn't be read
// (no file, or it vanished between listing the directory and reading it) — the board renders
// that as "—", never as zeros, so a missing night is never mistaken for a quiet one.
export type NightCounts = { ok: number; retry: number; fail: number };

export type NightSummary = {
  night: string;
  counts: NightCounts | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// One job's count is by how it last stood that night (styleguide: pure logic lives here, not
// in the view). Retries along the way don't change the tally — only the night's ending does.
export function countByLastStatus(rows: Night['rows']): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of rows) {
    counts[row.lastStatus] += 1;
  }
  return counts;
}

// Each night on disk, with its ok / retry / fail tally for the board to link and label.
export function nightSummaries(runsDir: string, nights: string[]): NightSummary[] {
  return nights.map((night) => {
    const data = readNight(runsDir, night);
    return { night, counts: data ? countByLastStatus(data.rows) : null };
  });
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightSummaries(config.runsDir, nightsOnDisk(config.runsDir)),
  };
}
