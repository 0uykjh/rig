// Saves one rig page as a single self-contained HTML file, for review from a copy (plan § 3).
// A command, not a browser's "save as": the page is server-rendered with its stylesheet inline
// and no client JS (ADR 0001), so what is fetched is what a reader sees.
//
//   pnpm preview                      # /digest/2026-10-28 -> preview/digest-2026-10-28.html
//   pnpm preview 2026-10-27 out.html  # any night, any path
//
// The lane banner comes from LANE_MARKER in the environment. Run it with the marker set for the
// review copy, and with it unset for the clean copy that replaces it afterwards (plan § 4).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';
import { lane } from '../src/lane.js';

const night = process.argv[2] ?? '2026-10-28';
const out = process.argv[3] ?? `preview/digest-${night}.html`;

const res = await createApp().request(`/digest/${night}`);
if (res.status !== 200) {
  console.error(`no page for ${night}: ${res.status}`);
  process.exit(1);
}

const html = await res.text();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out} · ${html.length} bytes · marker ${lane().marker ?? 'not set'}`);
