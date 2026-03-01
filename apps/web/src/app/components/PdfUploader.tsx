import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileText, Trash2 } from 'lucide-react';
import { cn } from './ui/utils';
import { storage } from '../lib/storage';
import type { PdfIndexDocument } from '../types';

interface PdfUploaderProps {
  onUploadComplete?: (result: { document: { docId: string; filename: string; pageCount: number }; chunkCount: number; pdfIndex?: PdfIndexDocument }) => void;
  onError?: (error: string) => void;
}

export function PdfUploader({ onUploadComplete, onError }: PdfUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    filename?: string;
    pageCount?: number;
    chunkCount?: number;
  }>({ type: null, message: '' });
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ docId: string; filename: string; pageCount: number; chunkCount: number; uploadedAt: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load uploaded files on mount
  useEffect(() => {
    const files = storage.getUploadedPdfFiles();
    setUploadedFiles(files.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleFile = async (file: File) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadStatus({
        type: 'error',
        message: 'Please upload a PDF file'
      });
      onError?.('Invalid file type. Only PDF files are allowed.');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadStatus({
        type: 'error',
        message: 'File too large (max 50MB)'
      });
      onError?.('File too large. Maximum size is 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/pdf-index/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Save the PDF index to localStorage so it can be used for hint generation
      if (result.document) {
        const saveResult = storage.savePdfIndex(result.document as PdfIndexDocument);
        if (!saveResult.success) {
          // Failed to save PDF index to storage (quota exceeded or other error)
        }
        
        // Add to uploaded files list
        const doc = result.document?.sourceDocs?.[0] || result.document;
        storage.addUploadedPdfFile({
          docId: doc.docId || result.document.indexId,
          filename: result.document?.sourceName || doc.filename || file.name,
          pageCount: doc.pageCount || 0,
          chunkCount: result.document?.chunkCount || result.manifest?.chunkCount || 0
        });
        
        // Refresh the list
        const updatedFiles = storage.getUploadedPdfFiles();
        setUploadedFiles(updatedFiles.files);
      }
      
      setUploadStatus({
        type: 'success',
        message: 'PDF uploaded and indexed successfully!',
        filename: result.document?.sourceName || result.document?.filename,
        pageCount: result.document?.sourceDocs?.[0]?.pageCount,
        chunkCount: result.document?.chunkCount || result.manifest?.chunkCount
      });

      onUploadComplete?.({
        document: result.document?.sourceDocs?.[0] || result.document,
        chunkCount: result.document?.chunkCount || result.manifest?.chunkCount,
        pdfIndex: result.document as PdfIndexDocument
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadStatus({
        type: 'error',
        message
      });
      onError?.(message);
    } finally {
      setIsUploading(false);
    }
  };

  const clearStatus = () => {
    setUploadStatus({ type: null, message: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (docId: string) => {
    storage.removeUploadedPdfFile(docId);
    const updatedFiles = storage.getUploadedPdfFiles();
    setUploadedFiles(updatedFiles.files);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      {uploadStatus.type ? (
        <div className={cn(
          'p-3 rounded-lg mb-3',
          uploadStatus.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        )}>
          <div className="flex items-start gap-2">
            {uploadStatus.type === 'success' ? (
              <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-medium',
                uploadStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
              )}>
                {uploadStatus.message}
              </p>
              {uploadStatus.filename && (
                <p className="text-xs text-gray-600 mt-1">
                  <span className="font-medium">File:</span> {uploadStatus.filename}
                </p>
              )}
              {uploadStatus.pageCount !== undefined && uploadStatus.chunkCount !== undefined && (
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Pages:</span> {uploadStatus.pageCount} | 
                  <span className="font-medium"> Chunks:</span> {uploadStatus.chunkCount}
                </p>
              )}
            </div>
            <button 
              onClick={clearStatus}
              className="shrink-0 p-1 hover:bg-white/50 rounded"
            >
              <X className="size-4 text-gray-500" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            className="hidden"
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-600">Uploading and indexing PDF...</p>
              <p className="text-xs text-gray-500">This may take a moment</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className={cn(
                'size-8',
                isDragging ? 'text-blue-600' : 'text-gray-400'
              )} />
              <p className="text-sm text-gray-600">
                <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF files up to 50MB</p>
            </div>
          )}
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Uploaded Textbooks ({uploadedFiles.length})
          </h3>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.docId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="size-5 text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {file.pageCount} pages • {file.chunkCount} chunks • {formatDate(file.uploadedAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFile(file.docId)}
                  className="p-1.5 hover:bg-red-100 rounded-lg transition-colors shrink-0"
                  title="Remove from list"
                >
                  <Trash2 className="size-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            These files are stored locally and will be remembered for future sessions.
          </p>
        </div>
      )}
    </div>
  );
}
