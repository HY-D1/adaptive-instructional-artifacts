import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Play, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { SQLExecutor, QueryResult } from '../lib/sql-executor';
import { SQLProblem } from '../types';

export const DEFAULT_SQL_EDITOR_CODE = '-- Write your SQL query here\nSELECT ';

interface SQLEditorProps {
  problem: SQLProblem;
  code: string;
  onExecute: (query: string, result: QueryResult) => void;
  onCodeChange: (code: string) => void;
  onReset?: () => void;
}

type CorrectnessState = {
  match: boolean;
  differences: string[];
  mode: 'result' | 'exec-only';
};

export function SQLEditor({ problem, code, onExecute, onCodeChange, onReset }: SQLEditorProps) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executor, setExecutor] = useState<SQLExecutor | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const activeExecutorRef = useRef<SQLExecutor | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setExecutor(null);

    const initExecutor = async () => {
      const exec = new SQLExecutor();
      activeExecutorRef.current = exec;
      try {
        await exec.initialize(problem.schema);
        if (isCancelled) {
          exec.close();
          if (activeExecutorRef.current === exec) {
            activeExecutorRef.current = null;
          }
          return;
        }
        setExecutor(exec);
      } catch {
        exec.close();
        if (activeExecutorRef.current === exec) {
          activeExecutorRef.current = null;
        }
        setExecutor(null);
      }
    };
    initExecutor();

    return () => {
      isCancelled = true;
      if (activeExecutorRef.current) {
        activeExecutorRef.current.close();
        activeExecutorRef.current = null;
      }
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
    setResult(null);
    onReset?.();
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    onCodeChange(newCode);
  };

  const formatResults = (result: QueryResult) => {
    if (!executor || !result.success) return [];
    return executor.formatResults(result);
  };

  const checkCorrectness = (): CorrectnessState | null => {
    if (!result || !result.success || !executor) return null;

    const gradingMode = problem.gradingMode ?? 'result';
    if (gradingMode === 'exec-only' || !problem.expectedResult) {
      return {
        match: true,
        differences: [],
        mode: 'exec-only'
      };
    }
    
    const actualResults = formatResults(result);
    const comparison = executor.compareResults(actualResults, problem.expectedResult);
    
    return { ...comparison, mode: 'result' };
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
                      {correctness.mode === 'exec-only' ? 'Ran successfully' : 'Correct!'}
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

                {correctness && correctness.mode === 'result' && !correctness.match && (
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
