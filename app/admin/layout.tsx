import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/app-favicon.ico' },
      { url: '/app-icon.png', type: 'image/png' },
    ],
    apple: [{ url: '/app-apple-icon.png' }],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
