import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { countNight } from '../src/status.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});

describe('night counts', () => {
  const row = (job: string, retries: number, lastStatus: 'ok' | 'retry' | 'fail') => ({
    job,
    owner: null,
    runs: retries + 1,
    retries,
    lastStatus,
    lastError: null,
    firstAt: '2026-10-28T23:00:00+01:00',
    lastAt: '2026-10-29T05:00:00+01:00',
  });

  it('counts a job that retried and then succeeded under both ok and retry', () => {
    expect(countNight([row('fixtures/refresh', 3, 'ok')])).toEqual({ ok: 1, retry: 1, fail: 0 });
  });

  it('counts the real night the way a reader would read it', () => {
    const counts = countNight([
      row('digest/render', 0, 'ok'),
      row('fixtures/refresh', 3, 'ok'),
      row('lane/sync', 1, 'ok'),
      row('notes/backup', 0, 'fail'),
      row('rig/rotate-logs', 0, 'ok'),
    ]);
    // Counting by how each job ended would say "0 retry" for a night with four retries.
    expect(counts).toEqual({ ok: 4, retry: 2, fail: 1 });
  });
});
