export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-dashed border-rule rounded-lg px-6 py-12 text-center">
      <h2 className="wide text-xl font-bold">{title}</h2>
      <p className="text-ink-soft mt-2 max-w-md mx-auto">{children}</p>
    </div>
  );
}
