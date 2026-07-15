import type { Metadata } from 'next';

/**
 * Metadata for auth pages. These should never be indexed.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
