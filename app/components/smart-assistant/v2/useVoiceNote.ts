'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';
/** Existing V1 transcription service, not P5 speech output or Realtime billing. */
export function useVoiceNote(visible: boolean, onText: (text: string) => void, onError: (message: string) => void) {
    const [state, setState] = useState<'off' | 'requesting' | 'recording' | 'transcribing'>('off');
    const stateRef = useRef(state);
    stateRef.current = state;
    const generation = useRef(0);
    const stream = useRef<MediaStream | null>(null);
    const recorder = useRef<MediaRecorder | null>(null);
    const cap = useRef<ReturnType<typeof setTimeout> | null>(null);
    const upload = useRef<AbortController | null>(null);
    const handlers = useRef({ onText, onError });
    handlers.current = { onText, onError };
    const cancel = useCallback(() => {
        generation.current++;
        if (cap.current)
            clearTimeout(cap.current);
        cap.current = null;
        upload.current?.abort();
        upload.current = null;
        if (recorder.current?.state === 'recording')
            recorder.current.stop();
        recorder.current = null;
        stream.current?.getTracks().forEach(t => t.stop());
        stream.current = null;
        setState('off');
    }, []);
    useEffect(() => { if (!visible)
        cancel(); return () => cancel(); }, [visible, cancel]);
    useEffect(() => { const hidden = () => { if (document.hidden)
        cancel(); }; document.addEventListener('visibilitychange', hidden); return () => document.removeEventListener('visibilitychange', hidden); }, [cancel]);
    const toggle = async () => {
        if (stateRef.current === 'recording') {
            recorder.current?.stop();
            return;
        }
        if (stateRef.current !== 'off' || !visible)
            return;
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            handlers.current.onError('Voice notes are unavailable here. Use Type instead.');
            return;
        }
        const current = ++generation.current;
        setState('requesting');
        try {
            const source = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (current !== generation.current) {
                source.getTracks().forEach(t => t.stop());
                return;
            }
            stream.current = source;
            const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(v => MediaRecorder.isTypeSupported(v));
            const rec = new MediaRecorder(source, mime ? { mimeType: mime } : undefined);
            recorder.current = rec;
            const chunks: Blob[] = [];
            let bytes = 0;
            let tooLarge = false;
            rec.ondataavailable = e => { bytes += e.data.size; if (bytes > 14 * 1024 * 1024) {
                tooLarge = true;
                if (rec.state === 'recording')
                    rec.stop();
            }
            else if (e.data.size)
                chunks.push(e.data); };
            rec.onerror = () => { if (current === generation.current) {
                cancel();
                handlers.current.onError('Recording stopped unexpectedly. Please try again.');
            } };
            rec.onstop = async () => {
                if (cap.current)
                    clearTimeout(cap.current);
                cap.current = null;
                source.getTracks().forEach(t => t.stop());
                stream.current = null;
                if (current !== generation.current)
                    return;
                if (tooLarge || bytes === 0) {
                    setState('off');
                    handlers.current.onError(tooLarge ? 'Voice note is too long. Try a shorter recording.' : 'No audio was captured.');
                    return;
                }
                setState('transcribing');
                const controller = new AbortController();
                upload.current = controller;
                try {
                    const data = new FormData();
                    data.append('audio', new Blob(chunks, { type: rec.mimeType }), rec.mimeType.includes('mp4') ? 'voice.mp4' : 'voice.webm');
                    const res = await fetch('/api/smart-assistant/transcribe', { method: 'POST', body: data, signal: controller.signal });
                    const result: unknown = await res.json();
                    if (current !== generation.current)
                        return;
                    if (!res.ok || !isRecord(result) || typeof result.text !== 'string')
                        throw new Error('Transcription failed. Try again or use Type.');
                    handlers.current.onText(result.text.trim());
                }
                catch (e) {
                    if (current === generation.current)
                        handlers.current.onError(e instanceof Error ? e.message : 'Transcription failed.');
                }
                finally {
                    if (current === generation.current) {
                        setState('off');
                        upload.current = null;
                    }
                }
            };
            rec.start(1000);
            setState('recording');
            cap.current = setTimeout(() => { if (rec.state === 'recording')
                rec.stop(); }, 120000);
        }
        catch (error) {
            if (current === generation.current) {
                cancel();
                const name = error instanceof DOMException ? error.name : '';
                const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
                const isIOS = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
                if (name === 'NotAllowedError' || name === 'SecurityError')
                    handlers.current.onError(isIOS
                        ? 'Microphone permission was denied. Allow microphone access for this site (iPhone: Settings, then Safari or Apps, then Microphone) and try again. You can also use Type.'
                        : 'Microphone permission was denied. Allow it for this site using the padlock or tune icon in the browser address bar, then try again. You can also use Type.');
                else if (standalone && isIOS)
                    handlers.current.onError('Voice input is not available in the installed home-screen app on iPhone. Open this site in the Safari browser app for voice notes, or use Type.');
                else if (name === 'NotFoundError' || name === 'OverconstrainedError')
                    handlers.current.onError('No microphone was found on this device. Use Type instead.');
                else
                    handlers.current.onError('Microphone could not be opened. Check permission or use Type.');
            }
        }
    };
    return { state, toggle, cancel };
}
