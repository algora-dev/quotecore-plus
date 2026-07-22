'use client';

import { useState, useRef, useCallback } from 'react';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';

interface ImageUploadProps {
  onParsed: (data: ParsedUploadResult) => void;
  onError: (message: string) => void;
  documentType: 'quote' | 'order' | 'invoice';
}

export interface ParsedUploadResult {
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  quoteNumber?: string;
  quoteDate: string;
  validDays: string;
  notes: string;
  lines: { description: string; qty: number; unit: string; rate: number }[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  remaining: number;
}

type Status = 'idle' | 'compressing' | 'uploading' | 'parsing' | 'done' | 'error';

const MAX_FILE_MB = 10;
const MAX_DIMENSION = 2000; // px - compress large photos down
const JPEG_QUALITY = 0.8;

export function ImageUpload({ onParsed, onError, documentType }: ImageUploadProps) {
  const { accessToken } = useFreeToolsAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(async (file: File): Promise<string> => {
    // Compress images via canvas
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

    // Always output JPEG for consistency (even PNGs become JPEG to save size)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return dataUrl;
  }, []);

  const handleFile = useCallback(async (file: File) => {
    // Validate
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      onError('Please upload a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      onError(`File too large. Maximum ${MAX_FILE_MB}MB.`);
      return;
    }

    setStatus('compressing');
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);

      setStatus('parsing');
      const res = await fetch('/api/free-tools/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
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

      const data: ParsedUploadResult = await res.json();
      setStatus('done');
      onParsed(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      onError(message);
    }
  }, [compressImage, documentType, onParsed, onError, accessToken]);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isLoading = status === 'compressing' || status === 'parsing';

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-900">AI Assist Image Upload</h2>
        </div>
        <svg
          className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-slate-500">Upload a document</h3>
            {status === 'done' && (
              <button
                onClick={reset}
                className="text-xs font-medium text-slate-500 hover:text-[#FF6B35] transition"
              >
                Upload another
              </button>
            )}
          </div>

          {status !== 'done' && (
            <div
              onClick={() => !isLoading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`
                relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition
                ${dragOver ? 'border-[#FF6B35] bg-orange-50/50' : 'border-slate-300 hover:border-slate-400'}
                ${isLoading ? 'pointer-events-none opacity-60' : ''}
              `}
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
                  <p className="text-sm font-medium text-slate-700">
                    Upload a photo or screenshot of your {documentType}
                  </p>
                  <p className="text-xs text-slate-400">
                    PNG, JPEG, or WebP · max {MAX_FILE_MB}MB
                  </p>
                  <p className="text-xs text-slate-400">
                    or drag and drop here
                  </p>
                </div>
              )}
            </div>
          )}

          {status === 'done' && preview && (
            <div className="flex items-start gap-3">
              {preview.startsWith('data:image') && (
                <img
                  src={preview}
                  alt="Uploaded document"
                  className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-medium text-slate-900">Document processed</p>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Review and edit the populated fields below.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-700">Failed to process document. Please try again or enter details manually.</p>
              <button onClick={reset} className="mt-1 text-xs font-medium text-red-600 hover:text-red-700">
                Try again
              </button>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            AI scans your document and fills in the form. 5 free scans per day.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Your upload is sent to our server for AI processing and is not stored after parsing.
          </p>
        </div>
      )}
    </div>
  );
}
