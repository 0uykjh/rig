// The shape of a night, and the one way to read it. Committed before anything in section 2, so
// the page, the JSON, the board link and the route tests can all be written against it at once.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing. `owner` is absent on some lines; the reader
// normalises it to null rather than dropping the line.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One job's night. `runs` counts every line for the job, `retries` only the ones that retried.
// Times keep the offset they had in the log; nothing here converts to UTC (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// A whole night. `badLines` counts lines that did not parse: they are counted, never thrown, so
// the night still renders. An empty file is a Night with no rows, which is "nothing ran" — not
// the same as a night with no file at all.
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// Reads runs/<night>.jsonl into one row per job. Returns null when that night has no file, which
// is what the page turns into a 404.
export type ReadNight = (runsDir: string, night: string) => Night | null;
