import { useCallback, useRef } from 'react';
import { useToast } from '../components/ui/toast';

interface StorageOperationResult {
  success: boolean;
  quotaExceeded?: boolean;
  error?: Error;
}

export function useStorageFeedback() {
  const { addToast } = useToast();
  const shownWarningsRef = useRef(new Set<string>());

  const handleStorageResult = useCallback((
    result: StorageOperationResult,
    options: {
      successMessage?: string;
      errorMessage?: string;
      quotaMessage?: string;
    } = {}
  ) => {
    const {
      successMessage = 'Operation completed successfully',
      errorMessage = 'Operation failed',
      quotaMessage = 'Storage quota exceeded. Try clearing some data.',
    } = options;

    if (result.success) {
      addToast({
        type: 'success',
        title: successMessage,
      });
      return true;
    }

    if (result.quotaExceeded) {
      addToast({
        type: 'warning',
        title: 'Storage Full',
        message: quotaMessage,
      });
      return false;
    }

    addToast({
      type: 'error',
      title: errorMessage,
      message: result.error?.message,
    });
    return false;
  }, [addToast]);

  const withFeedback = useCallback(<T extends () => StorageOperationResult>(
    operation: T,
    messages: Parameters<typeof handleStorageResult>[1]
  ): ReturnType<T> => {
    const result = operation();
    handleStorageResult(result, messages);
    return result as ReturnType<T>;
  }, [handleStorageResult]);

  const showWarningOnce = useCallback((key: string, message: string, title = 'Storage Full') => {
    if (shownWarningsRef.current.has(key)) {
      return false;
    }

    shownWarningsRef.current.add(key);
    addToast({
      type: 'warning',
      title,
      message,
    });
    return true;
  }, [addToast]);

  return {
    handleStorageResult,
    withFeedback,
    showWarningOnce,
  };
}
