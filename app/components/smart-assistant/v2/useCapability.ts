'use client';
import { useEffect, useState } from 'react';
import type { Access } from '@/app/lib/smart-assistant/v2/contracts';
import { capability } from './client';
export function useCapability() {
    const [state, setState] = useState<{
        ready: boolean;
        access: Access | null;
        error: string | null;
    }>({ ready: false, access: null, error: null });
    useEffect(() => { const controller = new AbortController(); capability(controller.signal).then(access => setState({ ready: true, access, error: null })).catch(error => { if (!controller.signal.aborted)
        setState({ ready: true, access: null, error: error instanceof Error ? error.message : 'Assistant unavailable.' }); }); return () => controller.abort(); }, []);
    return state;
}
