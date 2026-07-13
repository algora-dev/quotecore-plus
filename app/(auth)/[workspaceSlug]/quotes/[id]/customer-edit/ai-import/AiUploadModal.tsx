'use client';

import { useState, useRef, useCallback } from 'react';
import type { ParsedDocumentResult } from './types';

interface AiUploadModalProps {
  documentType: 'quote' | 'order' | 'invoice';
  onParsed: (data: ParsedDocumentResult) => void;
  onClose: () => void;
}

type Status = 'idle' | 'compressing' | 'uploading' | 'parsing' | 'done' | 'error';

const MAX_FILE_MB = 10;
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.8;

export function AiUploadModal({ documentType, onParsed, onClose }: AiUploadModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(async (file: File): Promise<string> => {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    let targetW = width;
    let targetH = height;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      targetW = Math.round(width * ratio);
      targetH = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a PNG, JPEG, or WebP image.');
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`File too large. Maximum ${MAX_FILE_MB}MB.`);
        return;
      }

      setStatus('compressing');
      setError('');
      try {
        const compressed = await compressImage(file);
        setPreview(compressed);

        setStatus('parsing');
        const res = await fetch('/api/app/parse-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: documentType,
            mode: 'image',
            image: compressed,
            imageMime: 'image/jpeg',
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error || 'Failed to process image');
        }

        const data: ParsedDocumentResult = await res.json();
        setStatus('done');
        onParsed(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus('error');
        setError(message);
      }
    },
    [compressImage, documentType, onParsed]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStatus('idle');
    setPreview(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isLoading = status === 'compressing' || status === 'parsing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Upload Image or PDF</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info banner */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <p className="text-xs text-blue-700 leading-relaxed">
            Upload a photo or screenshot of an existing quote, invoice, or handwritten notes.
            AI will read the document and pre-populate your quote lines in our professional format,
            saving you time manually transferring details.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            <strong>Supported:</strong> PNG, JPEG, WebP up to {MAX_FILE_MB}MB ·
            Images can contain printed text, handwriting, tables, or calculations.
          </p>
        </div>

        {/* Upload zone */}
        {status !== 'done' && (
          <div
            onClick={() => !isLoading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
              dragOver ? 'border-[#FF6B35] bg-orange-50/50' : 'border-slate-300 hover:border-slate-400'
            } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              capture="environment"
              onChange={onInputChange}
              className="hidden"
            />
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 animate-spin text-[#FF6B35]" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-600">
                  {status === 'compressing' ? 'Processing image...' : 'AI reading your document...'}
                </p>
                <p className="text-xs text-slate-400">This takes a few seconds</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-400">PNG, JPEG, or WebP · max {MAX_FILE_MB}MB</p>
              </div>
            )}
          </div>
        )}

        {/* Success state */}
        {status === 'done' && preview && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/50 p-4">
            {preview.startsWith('data:image') && (
              <img src={preview} alt="Uploaded document" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm font-medium text-slate-900">Document processed</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">Lines have been added to your quote. Review and edit as needed.</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={reset} className="mt-1 text-xs font-medium text-red-600 hover:text-red-700">
              Try again
            </button>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-xs text-slate-400">
          Your upload is sent to our server for AI processing and is <strong>not stored</strong> after parsing.
          It does not count against your storage limits.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          {status === 'done' ? (
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all"
            >
              Done
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
