import './globals.css';
import { ReactNode } from 'react';
import Providers from '@/components/Providers';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import FooterBar from '@/components/FooterBar';

export const metadata = {
  title: '8pod',
  description: 'The Operating System for Commercial Intelligence',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-console-bg">
        <Providers>
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen">
            <TopNav />
            <main className="flex-1 pb-12">{children}</main>
            <FooterBar />
          </div>
        </Providers>
      </body>
    </html>
  );
}
