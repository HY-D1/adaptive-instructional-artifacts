import { Badge } from '../../ui/badge';
import type { ErrorTransitionMatrix, ErrorChain } from '../../../lib/research/error-transitions';

interface Props {
  matrix?: ErrorTransitionMatrix[];
  maxTransitions?: number;
}

interface ChainViewProps {
  chains?: ErrorChain[];
  maxChains?: number;
}

export function ErrorTransitionView({ matrix: matrixProp, maxTransitions = 10 }: Props) {
  // Defensive: ensure matrix is always an array
  const matrix = matrixProp ?? [];
  const topTransitions = matrix.slice(0, maxTransitions);
  
  if (matrix.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No error transitions available
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {topTransitions.map((t, i) => (
        <div 
          key={`${t.fromError}-${t.toError}-${i}`} 
          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span className="text-xs font-medium text-gray-600 w-6">#{i + 1}</span>
          
          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 whitespace-nowrap">
            {t.fromError}
          </Badge>
          
          <span className="text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
          
          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 whitespace-nowrap">
            {t.toError}
          </Badge>
          
          <div className="flex-1 mx-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-400 rounded-full transition-all"
                  style={{ width: `${Math.min(t.probability * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 w-16 text-right">
                {Math.round(t.probability * 100)}%
              </span>
            </div>
          </div>
          
          <span className="text-xs text-gray-500 whitespace-nowrap">
            ({t.count} occurrence{t.count !== 1 ? 's' : ''})
          </span>
        </div>
      ))}
      
      {matrix.length > maxTransitions && (
        <div className="text-center text-sm text-gray-500 pt-2">
          + {matrix.length - maxTransitions} more transitions
        </div>
      )}
    </div>
  );
}

export function ErrorChainView({ chains: chainsProp, maxChains = 5 }: ChainViewProps) {
  // Defensive: ensure chains is always an array
  const chains = chainsProp ?? [];
  
  if (chains.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No common error chains found
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {chains.slice(0, maxChains).map((chain, i) => (
        <div 
          key={i} 
          className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded"
        >
          <span className="text-xs font-medium text-red-600 w-6">#{i + 1}</span>
          
          <Badge variant="outline" className="text-red-700 border-red-200 text-xs">
            {chain.startError}
          </Badge>
          
          {chain.chain.map((error, j) => (
            <div key={j} className="flex items-center gap-2">
              <span className="text-red-300">→</span>
              <Badge variant="outline" className="text-red-700 border-red-200 text-xs">
                {error}
              </Badge>
            </div>
          ))}
          
          <span className="ml-auto text-xs text-gray-500">
            {chain.count}×
          </span>
        </div>
      ))}
    </div>
  );
}

interface RecoveryPatternProps {
  patterns?: Array<{ errorType: string; recoveryRate: number; count: number }>;
  maxPatterns?: number;
}

export function ErrorRecoveryView({ patterns: patternsProp, maxPatterns = 8 }: RecoveryPatternProps) {
  // Defensive: ensure patterns is always an array
  const patterns = patternsProp ?? [];
  
  if (patterns.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No recovery data available
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {patterns.slice(0, maxPatterns).map((pattern) => (
        <div 
          key={pattern.errorType}
          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded"
        >
          <Badge 
            variant="outline" 
            className="text-xs whitespace-nowrap"
            style={{
              borderColor: pattern.recoveryRate > 0.7 ? '#86efac' : 
                           pattern.recoveryRate > 0.4 ? '#fcd34d' : '#fca5a5',
              backgroundColor: pattern.recoveryRate > 0.7 ? '#f0fdf4' : 
                               pattern.recoveryRate > 0.4 ? '#fffbeb' : '#fef2f2'
            }}
          >
            {pattern.errorType}
          </Badge>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${pattern.recoveryRate * 100}%`,
                    backgroundColor: pattern.recoveryRate > 0.7 ? '#22c55e' : 
                                     pattern.recoveryRate > 0.4 ? '#f59e0b' : '#ef4444'
                  }}
                />
              </div>
              <span className="text-sm font-medium w-14 text-right">
                {Math.round(pattern.recoveryRate * 100)}%
              </span>
            </div>
          </div>
          
          <span className="text-xs text-gray-500">
            {pattern.count} errors
          </span>
        </div>
      ))}
    </div>
  );
}
