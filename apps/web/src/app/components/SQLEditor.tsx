import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Play, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { SQLExecutor, QueryResult } from '../lib/sql-executor';
import { SQLProblem } from '../types';

interface SQLEditorProps {
  problem: SQLProblem;
  onExecute: (query: string, result: QueryResult) => void;
  onCodeChange?: (code: string) => void;
}

export function SQLEditor({ problem, onExecute, onCodeChange }: SQLEditorProps) {
  const [code, setCode] = useState('-- Write your SQL query here\nSELECT ');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executor, setExecutor] = useState<SQLExecutor | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    const initExecutor = async () => {
      const exec = new SQLExecutor();
      await exec.initialize(problem.schema);
      setExecutor(exec);
    };
    initExecutor();

    return () => {
      executor?.close();
    };
  }, [problem.id]);

  const handleExecute = async () => {
    if (!executor || !code.trim()) return;

    setIsExecuting(true);
    try {
      const queryResult = await executor.executeQuery(code);
      setResult(queryResult);
      onExecute(code, queryResult);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setCode('-- Write your SQL query here\nSELECT ');
    setResult(null);
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    onCodeChange?.(newCode);
  };

  const formatResults = (result: QueryResult) => {
    if (!executor || !result.success) return [];
    return executor.formatResults(result);
  };

  const checkCorrectness = () => {
    if (!result || !result.success || !executor) return null;
    
    const actualResults = formatResults(result);
    const comparison = executor.compareResults(actualResults, problem.expectedResult);
    
    return comparison;
  };

  const correctness = checkCorrectness();

  return (
    <div className="flex flex-col h-full gap-4">
      <Card className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex gap-2">
              <Button
                onClick={handleExecute}
                disabled={isExecuting || !code.trim()}
                size="sm"
              >
                <Play className="size-4 mr-2" />
                {isExecuting ? 'Executing...' : 'Run Query'}
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm">
                <RotateCcw className="size-4 mr-2" />
                Reset
              </Button>
            </div>
            {correctness && (
              <div className="flex items-center gap-2">
                {correctness.match ? (
                  <>
                    <CheckCircle className="size-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">
                      Correct!
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">
                      Not quite right
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={code}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </Card>

      {result && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Results</h3>
              {result.executionTime && (
                <span className="text-sm text-gray-500">
                  {result.executionTime.toFixed(2)}ms
                </span>
              )}
            </div>

            {result.success ? (
              <>
                {result.values && result.values.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border">
                      <thead className="bg-gray-50">
                        <tr>
                          {result.columns?.map((col, idx) => (
                            <th key={idx} className="px-4 py-2 text-left border-b font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.values.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b">
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-2">
                                {cell === null ? (
                                  <span className="text-gray-400 italic">NULL</span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">Query executed successfully. No results returned.</p>
                )}

                {correctness && !correctness.match && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-sm font-medium text-amber-800 mb-2">
                      Your query returned different results:
                    </p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {correctness.differences.slice(0, 3).map((diff, idx) => (
                        <li key={idx}>• {diff}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm font-medium text-red-800 mb-1">Error</p>
                <p className="text-sm text-red-700 font-mono">{result.error}</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
