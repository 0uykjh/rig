import type { DigestRow, Night } from '../digest/types.js';

// Missing data renders as `—`, never an empty cell and never dropped (styleguide). Times keep
// the offset from the log; nothing here converts to UTC.
const dash = '—';

function warn(row: DigestRow): boolean {
  return row.lastStatus === 'fail' || row.retries >= 3;
}

export function Digest({ night }: { night: Night }) {
  const rows = [...night.rows].sort((a, b) => a.job.localeCompare(b.job));

  return (
    <>
      <h1>digest · {night.night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr class={warn(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? dash}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? dash}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 ? (
        <p class="mute">
          {night.badLines} line{night.badLines === 1 ? '' : 's'} did not parse
        </p>
      ) : null}
    </>
  );
}
