import ConsoleSidebar from '@/components/ConsoleSidebar';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-console-bg">
      <ConsoleSidebar />
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
