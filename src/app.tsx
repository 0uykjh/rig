import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Digest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Issue #3: GET /digest/:night — one table, sorted by job, "nothing ran" when empty, 404 when
  // the night has no file at all.
  app.get('/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (night === null) return c.notFound();
    return c.html(
      <Layout title={`digest · ${night.night}`} lane={lane()}>
        <Digest night={night} />
      </Layout>,
    );
  });

  // Same reader, same sort as the page (ADR 0001): the JSON and /digest/:night can never
  // disagree because both read a night through readNight and nothing reshapes it after.
  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (night === null) return c.notFound();
    return c.json(night);
  });

  return app;
}
