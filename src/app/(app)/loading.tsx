// Shown instantly while a page's data loads, so a click never looks ignored.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4 pt-2">
      <div className="h-10 w-56 rounded-lg bg-surface" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 card" />)}
      </div>
      <div className="h-72 card" />
    </div>
  );
}
