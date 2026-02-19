import { useState, useEffect, useRef, useCallback, type Editor as MonacoEditorType } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';
import { Play, RotateCcw, CheckCircle, XCircle, AlertCircle, Terminal, Loader2, Copy, Check, Trash2, Keyboard, Lightbulb, RefreshCw } from 'lucide-react';
import { SQLExecutor, QueryResult, resetSQLInitialization } from '../lib/sql-executor';
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

/**
 * SQLEditor - Monaco-based SQL code editor with execution
 * 
 * Features:
 * - Monaco Editor integration for SQL syntax highlighting
 * - Query execution with SQLite WASM
 * - Correctness checking against expected results
 * - Error parsing with line/column indicators
 * - Keyboard shortcuts (Ctrl+Enter to run)
 * 
 * @param props - SQLEditorProps configuration
 */
export function SQLEditor({ problem, code, onExecute, onCodeChange, onReset }: SQLEditorProps) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executor, setExecutor] = useState<SQLExecutor | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [initError, setInitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const activeExecutorRef = useRef<SQLExecutor | null>(null);
  const editorRef = useRef<MonacoEditorType | null>(null);
  const disposeTimeoutRef = useRef<number | null>(null);
  const initAttemptRef = useRef(0);

  const isMountedRef = useRef(true);

  const handleEditorDidMount = (editor: MonacoEditorType) => {
    if (!isMountedRef.current) {
      // Component unmounted, dispose immediately
      const model = editor.getModel();
      if (model) model.dispose();
      editor.dispose();
      return;
    }
    editorRef.current = editor;
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear any pending dispose timeout to prevent race conditions
      if (disposeTimeoutRef.current) {
        clearTimeout(disposeTimeoutRef.current);
        disposeTimeoutRef.current = null;
      }
      // Dispose Monaco editor instance on unmount
      // Small delay to ensure any in-progress mount completes
      disposeTimeoutRef.current = window.setTimeout(() => {
        if (editorRef.current) {
          // Remove all event listeners before disposal to prevent memory leaks
          const model = editorRef.current.getModel();
          if (model) {
            model.dispose();
          }
          editorRef.current.dispose();
          editorRef.current = null;
        }
        disposeTimeoutRef.current = null;
      }, 0);
    };
  }, []);

  // SQL executor initialization function
  const initExecutor = useCallback(async (signal?: AbortSignal) => {
    console.log('[SQLEditor] Starting SQL executor initialization...');
    setInitStatus('loading');
    setInitError(null);
    setExecutor(null);
    
    const exec = new SQLExecutor();
    
    try {
      await exec.initialize(problem.schema);
      if (!signal?.aborted) {
        setExecutor(exec);
        setInitStatus('ready');
        console.log('[SQLEditor] SQL executor initialized successfully');
        return exec;
      } else {
        exec.close();
        setInitStatus('idle');
        console.log('[SQLEditor] Initialization aborted');
        return null;
      }
    } catch (error) {
      exec.close();
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize SQL engine';
      console.error('[SQLEditor] Initialization failed:', error);
      console.error('[SQLEditor] Error details:', {
        message: errorMsg,
        error: error instanceof Error ? {
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5).join('\n')
        } : 'Unknown error'
      });
      setInitError(errorMsg);
      setInitStatus('error');
      if (!signal?.aborted) {
        setExecutor(null);
      }
      throw error;
    }
  }, [problem.schema]);

  // Handle retry initialization
  const handleRetryInit = useCallback(async () => {
    setIsRetrying(true);
    initAttemptRef.current += 1;
    
    // Reset SQL initialization state to allow fresh attempt
    resetSQLInitialization();
    
    try {
      await initExecutor();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  }, [initExecutor]);

  useEffect(() => {
    const abortController = new AbortController();
    initAttemptRef.current = 0;

    initExecutor(abortController.signal).catch(() => {
      // Error is handled in initExecutor
    });

    return () => {
      abortController.abort();
    };
  }, [problem.id, initExecutor]);

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

  const handleClearResults = () => {
    setResult(null);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
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
    <div className="flex flex-col h-full gap-4">
        <Card className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50/50 flex-wrap gap-2">
              <div className="flex gap-2 items-center flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleExecute}
                      disabled={isExecuting || !code.trim() || initStatus !== 'ready'}
                      size="sm"
                      data-testid="run-query-btn"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="size-4 mr-2" />
                      {isExecuting ? 'Executing...' : initStatus === 'loading' ? 'Loading...' : 'Run Query'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex items-center gap-2">
                      <span>Run query</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-100 border rounded">Ctrl+Enter</kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleReset} variant="outline" size="sm">
                      <RotateCcw className="size-4 mr-2" />
                      Reset
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Reset editor and clear results</p>
                  </TooltipContent>
                </Tooltip>
                {result && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleClearResults} variant="outline" size="sm">
                        <Trash2 className="size-4 mr-2" />
                        Clear Results
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Clear query results</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleCopyCode} variant="outline" size="sm">
                      {copied ? (
                        <>
                          <Check className="size-4 mr-2 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Copy SQL to clipboard</p>
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
            
            <div className="flex-1 overflow-hidden relative" aria-label="SQL code editor" role="region">
              {/* Initialization Loading Overlay */}
              {initStatus === 'loading' && (
                <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
                    <Loader2 className="size-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Initializing SQL Engine...</p>
                      <p className="text-xs text-gray-500">Setting up problem database</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Initialization Error Message */}
              {initStatus === 'error' && (
                <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-4 shadow-lg max-w-md mx-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Failed to Initialize SQL Engine</p>
                        <p className="text-xs text-gray-600 mt-1">{initError || 'An unexpected error occurred'}</p>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleRetryInit}
                            disabled={isRetrying}
                          >
                            {isRetrying ? (
                              <>
                                <Loader2 className="size-3 mr-1 animate-spin" />
                                Retrying...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="size-3 mr-1" />
                                Try Again
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.reload()}
                          >
                            Reload Page
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
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
                  readOnly: initStatus !== 'ready',
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
                    <div className="p-1.5 bg-red-100 rounded-full shrink-0">
                      <AlertCircle className="size-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-semibold text-red-800">SQL Error</p>
                        {parsedError?.lineNumber && (
                          <Badge variant="outline" className="text-xs font-mono bg-red-100 border-red-300 text-red-800">
                            Line {parsedError.lineNumber}
                            {parsedError.columnNumber && `, Col ${parsedError.columnNumber}`}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="bg-white border border-red-200 rounded-lg p-3 overflow-x-auto shadow-sm">
                        <code className="text-sm text-red-700 font-mono whitespace-pre-wrap block">
                          {parsedError?.formattedMessage || result.error}
                        </code>
                      </div>
                      
                      {parsedError?.lineNumber && (
                        <div className="mt-3 p-3 bg-red-100/70 rounded-lg border border-red-200">
                          <p className="text-xs font-semibold text-red-800 mb-1 flex items-center gap-1.5">
                            <Lightbulb className="size-3.5" />
                            Suggestion
                          </p>
                          <p className="text-xs text-red-700">
                            Check line {parsedError.lineNumber} for syntax errors. Common issues include missing commas, 
                            incorrect table/column names, or unmatched parentheses.
                          </p>
                        </div>
                      )}
                      
                      {/* Quick fix suggestions for common errors */}
                      {parsedError?.message?.toLowerCase().includes('no such column') && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs text-amber-800">
                            <span className="font-medium">Tip:</span> Check the database schema for available columns. 
                            Column names are case-sensitive.
                          </p>
                        </div>
                      )}
                      {parsedError?.message?.toLowerCase().includes('no such table') && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs text-amber-800">
                            <span className="font-medium">Tip:</span> Verify the table name in the schema. 
                            Make sure you are using the correct database.
                          </p>
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
  );
}
