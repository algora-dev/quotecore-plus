import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Demo master switches (demo_control row 1). Owner requirement 2026-09-28:
 * a kill switch that takes effect on the next request without a deploy.
 * Both default OFF — the demo ships dark and is enabled from /admin/demo.
 */
export type DemoControl = {
  demoEnabled: boolean;
  aiEnabled: boolean;
  updatedAt: string | null;
};

const OFF: DemoControl = { demoEnabled: false, aiEnabled: false, updatedAt: null };

export const getDemoControl = cache(async (): Promise<DemoControl> => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('demo_control')
      .select('demo_enabled,ai_enabled,updated_at')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return OFF;
    return {
      demoEnabled: data.demo_enabled === true,
      aiEnabled: data.ai_enabled === true,
      updatedAt: (data.updated_at as string | null) ?? null,
    };
  } catch {
    // Fail closed: if the control row/table is unreachable, everything reads OFF.
    return OFF;
  }
});

export async function isDemoEnabled(): Promise<boolean> {
  return (await getDemoControl()).demoEnabled;
}

/** AI additionally requires the demo master switch — AI can never run standalone. */
export async function isDemoAiEnabled(): Promise<boolean> {
  const c = await getDemoControl();
  return c.demoEnabled && c.aiEnabled;
}
