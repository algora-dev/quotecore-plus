'use client';
import { useState, useRef } from 'react';

interface Props {
  accept?: string;
  maxSize?: number; // bytes
  onUpload: (file: File) => Promise<void>;
  currentFileUrl?: string | null;
  label?: string;
  description?: string;
}

export function FileUploader({
  accept = 'image/*',
  maxSize = 2097152, // 2 MB default
  onUpload,
  currentFileUrl,
  label = 'Upload File',
  description = 'Click to browse or drag and drop',
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    if (maxSize && file.size > maxSize) {
      const maxMB = (maxSize / 1024 / 1024).toFixed(1);
      return `File too large. Max size: ${maxMB} MB`;
    }

    if (accept && !accept.includes('*')) {
      const allowedTypes = accept.split(',').map(t => t.trim());
      if (!allowedTypes.some(type => file.type.match(type.replace('*', '.*')))) {
        return `Invalid file type. Allowed: ${accept}`;
      }
    }

    return null;
  }

  async function handleFile(file: File) {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3">
      {/* Current file preview */}
      {currentFileUrl && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <img
            src={currentFileUrl}
            alt="Current file"
            className="w-16 h-16 object-contain rounded border border-slate-300"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">Current file</p>
            <p className="text-xs text-slate-500">Upload a new file to replace</p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-white'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={uploading}
          className="hidden"
        />

        <div className="space-y-2">
          {uploading ? (
            <>
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-600">Uploading...</p>
            </>
          ) : (
            <>
              <svg className="mx-auto w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Max size: {(maxSize / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}
