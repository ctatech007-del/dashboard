import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="sky min-h-screen grid place-items-center p-6">
      <div className="sheet relative z-10 max-w-sm rounded-3xl p-8 text-center">
        <p className="display text-5xl">404</p>
        <p className="mt-2 text-ink-soft">This page doesn’t exist.</p>
        <p className="mt-6 flex justify-center gap-3 text-sm font-bold">
          <Link href="/hub" className="btn">Student Hub</Link>
          <Link href="/" className="btn btn-quiet">Student Stats</Link>
        </p>
      </div>
    </main>
  );
}
