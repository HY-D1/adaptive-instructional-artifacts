import { useEffect, useId, useRef, useState } from 'react';
import { startExampleRun, type ExampleOutput } from '../../../lib/content/concept-example-runner';
import type { QueryResult } from '../../../lib/sql-executor';

interface Example { title: string; sql?: string; schema?: string; explanation: string; inspectSql?: string }
function Results({ result }: { result: QueryResult }) {
  if (!result.success) return <p role="alert" className="text-red-700">{result.error}</p>;
  const sets = result.allResults?.length ? result.allResults : result.columns?.length ? [{ columns: result.columns, values: result.values ?? [] }] : [];
  return <div className="space-y-3">{sets.length === 0 ? <p>Statement executed. No result rows returned.</p> : sets.map((set, i) => <div key={i} className="overflow-x-auto"><table className="w-full border-collapse text-sm"><caption className="text-left">Result {i + 1} (up to 100 rows)</caption><thead><tr>{set.columns.map((column, j) => <th scope="col" className="border p-2 text-left" key={j}>{column}</th>)}</tr></thead><tbody>{set.values.slice(0, 100).map((row, j) => <tr key={j}>{row.map((cell, k) => <td className="border p-2" key={k}>{cell === null ? 'NULL' : String(cell)}</td>)}</tr>)}</tbody></table>{set.values.length === 0 && <p>No matching rows.</p>}</div>)}</div>;
}
export function InteractiveExample({ example }: { example: Example }) {
  const id = useId();
  const [sql, setSql] = useState(example.sql ?? '');
  const [output, setOutput] = useState<ExampleOutput | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<ReturnType<typeof startExampleRun> | null>(null);
  useEffect(() => {
    setSql(example.sql ?? ''); setOutput(null); setError(''); setBusy(false);
    return () => { const run = active.current; active.current = null; run?.cancel(); };
  }, [example]);
  const cancel = () => { const run = active.current; active.current = null; run?.cancel(); setBusy(false); setError('Example run cancelled.'); };
  const run = async () => {
    active.current?.cancel();
    setBusy(true); setError(''); setOutput(null);
    const current = startExampleRun({ schema: example.schema ?? '', sql, inspectSql: example.inspectSql });
    active.current = current;
    try { const result = await current.promise; if (active.current === current) setOutput(result); }
    catch (failure) { if (active.current === current) setError(failure instanceof Error ? failure.message : 'Example failed.'); }
    finally { if (active.current === current) { active.current = null; setBusy(false); } }
  };
  const runnable = example.sql !== undefined && example.schema !== undefined;
  return <section className="min-w-0 space-y-4 rounded-lg border bg-white p-4">
    <h3 className="font-semibold">{example.title}</h3><p className="text-gray-700">{example.explanation}</p>
    {runnable ? <><details><summary className="cursor-pointer font-medium">Sample data and setup</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre text-xs">{example.schema || 'No tables required for this example.'}</pre></details><label htmlFor={id} className="block font-medium">Editable SQL — {example.title}</label><textarea id={id} value={sql} onChange={event => setSql(event.target.value)} spellCheck={false} rows={6} className="w-full rounded border p-3 font-mono text-sm focus-visible:outline-blue-600" /><p className="text-sm text-gray-600">SQLite sandbox. Each run starts with fresh sample data; practice progress is unchanged.</p><div className="flex flex-wrap gap-2"><button className="rounded bg-blue-600 px-4 py-3 text-white disabled:opacity-50" disabled={busy || !sql.trim()} onClick={run}>{busy ? 'Running…' : 'Run example'}</button><button className="rounded border px-4 py-3" onClick={() => { cancel(); setSql(example.sql ?? ''); setOutput(null); setError(''); }}>Reset example</button>{busy && <button className="rounded border px-4 py-3" onClick={cancel}>Cancel run</button>}</div></> : example.sql && <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-sm"><code>{example.sql}</code></pre>}
    <div aria-live="polite" aria-busy={busy}>{error && <p role="alert" className="text-red-700">{error}</p>}{output && <div className="space-y-4"><Results result={output.result} />{output.inspection && <><h4 className="font-medium">Database after your statement</h4><Results result={output.inspection} /></>}</div>}</div>
  </section>;
}
