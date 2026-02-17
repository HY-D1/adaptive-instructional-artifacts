import { useState, useEffect, useRef, type Editor as MonacoEditorType } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';
import { Play, RotateCcw, CheckCircle, XCircle, AlertCircle, Terminal } from 'lucide-react';
import { SQLExecutor, QueryResult } from '../lib/sql-executor';
import { SQLProblem } from '../types';

export const DEFAULT_SQL_EDITOR_CODE = '-- Write your SQL query here\nSELECT ';

interface SQLEditorProps {
  problem: SQLProblem;
  code: string;
  onExecute: (query: string, result: QueryResult, isCorrect?: boolean) => void;
  onCodeChange: (code: string) => void;
  onReset?: () => void;
}

type CorrectnessState = {
  match: boolean;
  differences: string[];
  mode: 'result' | 'exec-only';
};

// Parse SQL error to extract line numbers and format message
function parseSqlError(error: string): {
  message: string;
  lineNumber?: number;
  columnNumber?: number;
  formattedMessage: string;
} {
  // Common SQL error patterns
  const lineColumnPattern = /(?:at position|line)\s*(\d+)(?::|,\s*column)?\s*(\d+)?/i;
  const nearPattern = /near\s+"([^"]+)"/i;
  
  const lineMatch = error.match(lineColumnPattern);
  const nearMatch = error.match(nearPattern);
  
  const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
  const columnNumber = lineMatch?.[2] ? parseInt(lineMatch[2], 10) : undefined;
  
  // Clean up the error message
  let message = error
    .replace(/\[.*\]\s*/g, '') // Remove bracketed prefixes
    .replace(/Error:\s*/i, '') // Remove "Error:" prefix
    .trim();
  
  return {
    message,
    lineNumber,
    columnNumber,
    formattedMessage: message
  };
}

export function SQLEditor({ problem, code, onExecute, onCodeChange, onReset }: SQLEditorProps) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executor, setExecutor] = useState<SQLExecutor | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const activeExecutorRef = useRef<SQLExecutor | null>(null);
  const editorRef = useRef<MonacoEditorType | null>(null);

  const handleEditorDidMount = (editor: MonacoEditorType) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    return () => {
      // Dispose Monaco editor instance on unmount
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

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

  // Helper to check correctness given a result (used for immediate feedback)
  const checkCorrectnessForResult = (result: QueryResult): { match: boolean; mode: 'result' | 'exec-only' } | null => {
    if (!result.success || !executor) return null;

    const hasExpectedResult = problem.expectedResult && problem.expectedResult.length > 0;
    const gradingMode = problem.gradingMode ?? (hasExpectedResult ? 'result' : 'exec-only');
    
    if (gradingMode === 'exec-only') {
      return { match: result.success, mode: 'exec-only' };
    }
    
    const actualResults = executor.formatResults(result);
    const comparison = executor.compareResults(actualResults, problem.expectedResult!);
    
    return { match: comparison.match, mode: 'result' };
  };

  const handleExecute = async () => {
    if (!executor || !code.trim()) return;

    setIsExecuting(true);
    try {
      const queryResult = await executor.executeQuery(code);
      setResult(queryResult);
      
      // Calculate correctness to pass to parent
      const correctness = checkCorrectnessForResult(queryResult);
      onExecute(code, queryResult, correctness?.match ?? queryResult.success);
    } catch (error) {
      console.error('Query execution error:', error);
      const errorResult: QueryResult = {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred during query execution'
      };
      setResult(errorResult);
      onExecute(code, errorResult, false);
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

    // Determine grading mode: explicit mode takes precedence, then fall back to
    // result-check if expectedResult exists with data, otherwise exec-only
    const hasExpectedResult = problem.expectedResult && problem.expectedResult.length > 0;
    const gradingMode = problem.gradingMode ?? (hasExpectedResult ? 'result' : 'exec-only');
    
    if (gradingMode === 'exec-only') {
      return {
        match: result.success,
        differences: [],
        mode: 'exec-only'
      };
    }
    
    const actualResults = formatResults(result);
    const comparison = executor.compareResults(actualResults, problem.expectedResult!);
    
    return { ...comparison, mode: 'result' };
  };

  const correctness = checkCorrectness();
  const parsedError = result?.error ? parseSqlError(result.error) : null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col h-full gap-4">
        <Card className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleExecute}
                      disabled={isExecuting || !code.trim()}
                      size="sm"
                      data-testid="run-query-btn"
                    >
                      <Play className="size-4 mr-2" />
                      {isExecuting ? 'Executing...' : 'Run Query'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Run query (Ctrl+Enter)</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleReset} variant="outline" size="sm">
                      <RotateCcw className="size-4 mr-2" />
                      Reset
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset editor and results</p>
                  </TooltipContent>
                </Tooltip>
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
                onMount={handleEditorDidMount}
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
                <h3 className="font-semibold flex items-center gap-2">
                  <Terminal className="size-4" />
                  Results
                </h3>
                {result.executionTime && (
                  <Badge variant="outline" className="font-mono">
                    {result.executionTime.toFixed(2)}ms
                  </Badge>
                )}
              </div>

              {result.success ? (
                <>
                  {result.values && result.values.length > 0 ? (
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
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
                            <tr key={rowIdx} className="border-b last:border-b-0 hover:bg-gray-50">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-4 py-2">
                                  {cell === null ? (
                                    <span className="text-gray-400 italic">NULL</span>
                                  ) : (
                                    <span className="font-mono text-xs">{String(cell)}</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                      <CheckCircle className="size-6 mx-auto mb-2 text-green-600" />
                      <p className="text-green-800">Query executed successfully. No results returned.</p>
                    </div>
                  )}

                  {correctness && correctness.mode === 'result' && !correctness.match && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                        <AlertCircle className="size-4" />
                        Your query returned different results:
                      </p>
                      <ul className="text-sm text-amber-700 space-y-1">
                        {correctness.differences.slice(0, 3).map((diff, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-500">•</span>
                            {diff}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-800 mb-2">SQL Error</p>
                      
                      {parsedError?.lineNumber && (
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs font-mono bg-red-100">
                            Line {parsedError.lineNumber}
                            {parsedError.columnNumber && `, Col ${parsedError.columnNumber}`}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="bg-white border border-red-200 rounded p-3 overflow-x-auto">
                        <code className="text-sm text-red-700 font-mono whitespace-pre-wrap">
                          {parsedError?.formattedMessage || result.error}
                        </code>
                      </div>
                      
                      {parsedError?.lineNumber && (
                        <div className="mt-3 p-2 bg-red-100/50 rounded text-xs text-red-700">
                          <p className="font-medium">Tip:</p>
                          <p>Check line {parsedError.lineNumber} for syntax errors.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
