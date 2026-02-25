import Sidebar from '@/components/pipeline/sidebar';
import Link from 'next/link';

export const metadata = {
  title: 'Pipeline Dashboard',
};

export default function PipelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Override the blog header with a pipeline-specific header */}
      <style>{`
        /* Hide the blog header/footer when inside pipeline layout.
           The pipeline layout provides its own header. */
        body > header { display: none !important; }
        body > footer { display: none !important; }
      `}</style>
      <div className="min-h-screen flex flex-col">
        {/* Pipeline header */}
        <header className="border-b border-[var(--color-border)] bg-white sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <Link href="/pipeline" className="text-lg font-bold text-[var(--color-primary)]">
                Pipeline Dashboard
              </Link>
            </div>
            <Link
              href="/"
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              블로그로 이동 &rarr;
            </Link>
          </div>
        </header>

        {/* Body: sidebar + content */}
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 bg-white overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
