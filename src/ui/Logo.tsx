import { BRAND } from '../config/brand';
import { classNames } from '../lib/format';

/** Merkteken. Staat bewust los van de productcomponenten, zodat de homepage geen three.js hoeft te laden. */
export function Logo({ tone = 'light', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-volt text-volt-ink">
        <svg viewBox="0 0 32 32" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden>
          <path d="M6 12v8M10 8.5v15M22 8.5v15M26 12v8M10 16h12" />
        </svg>
      </span>
      {!compact && (
        <span className={classNames('display text-[17px] tracking-tight', tone === 'dark' ? 'text-white' : 'text-ink-900')}>
          {BRAND.short}
          <span className={tone === 'dark' ? 'text-volt' : 'text-ink-400'}> {BRAND.accent}</span>
        </span>
      )}
    </span>
  );
}
