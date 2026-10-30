import type { NightCounts, Status } from '../status.js';

// A night's counts as "ok · retry · fail", or "—" when the night couldn't be read. Missing
// data renders as "—", never blank (styleguide).
function Counts({ counts }: { counts: NightCounts | null }) {
  if (counts === null) return <>—</>;
  return (
    <>
      {counts.ok} ok · {counts.retry} retry · {counts.fail} fail
    </>
  );
}

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map((n) => (
            <li>
              <a href={`/digest/${n.night}`}>{n.night}</a> · <Counts counts={n.counts} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
