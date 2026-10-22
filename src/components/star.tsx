/** The brand starburst: long thin rays, as in the reference. Colour comes from `currentColor`. */
export function Star({ className = '', rays = 10 }: { className?: string; rays?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < rays * 2; i++) {
    const r = i % 2 ? 9 : 50;
    const a = (Math.PI * i) / rays - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon points={pts.join(' ')} fill="currentColor" />
    </svg>
  );
}
