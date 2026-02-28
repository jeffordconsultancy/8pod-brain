import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: '8pod OS | Control Console',
  description: 'Proprietary Intelligence Infrastructure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-console-bg text-console-text min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
