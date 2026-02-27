import './globals.css';
import { ReactNode } from 'react';
import Providers from '@/components/Providers';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: '8pod Brain',
  description: 'Central Intelligence Layer',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Providers>
          <Sidebar />
          <main className="flex-1 p-8 bg-gray-950">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
