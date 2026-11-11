import { Check, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { classNames, parseNumber } from '../lib/format';
import { useToastStore, type Toast } from '../state/uiStore';

// ─────────────────────────────────────── Knoppen ───────────────────────────────────────

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-volt text-volt-ink hover:bg-volt-deep active:translate-y-px shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]',
  dark: 'bg-ink-900 text-white hover:bg-ink-700 active:translate-y-px',
  outline: 'border border-sand-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-sand-50',
  ghost: 'text-ink-600 hover:bg-ink-900/[0.06] hover:text-ink-900',
  danger: 'border border-danger/30 bg-white text-danger hover:bg-danger-soft',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-2xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export function buttonClass(variant: ButtonVariant = 'outline', size: ButtonSize = 'md', block = false): string {
  return classNames(
    'inline-flex shrink-0 items-center justify-center font-semibold transition select-none disabled:opacity-45 disabled:pointer-events-none',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
  );
}

export function Button({ variant = 'outline', size = 'md', icon, iconRight, block, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={classNames(buttonClass(variant, size, block), className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'light' | 'dark' | 'danger';
  size?: 'sm' | 'md';
  active?: boolean;
}

export function IconButton({ label, tone = 'light', size = 'md', active, className, children, type = 'button', ...rest }: IconButtonProps) {
  const tones = {
    light: active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/[0.07] hover:text-ink-900',
    dark: active ? 'bg-white/20 text-white' : 'text-ink-200 hover:bg-white/10 hover:text-white',
    danger: 'text-ink-500 hover:bg-danger-soft hover:text-danger',
  };
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={classNames(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition disabled:opacity-35 disabled:pointer-events-none',
        size === 'sm' ? 'size-8' : 'size-9',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────── Invoer ───────────────────────────────────────

interface NumberFieldProps {
  label?: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Aantal decimalen in de weergave. */
  decimals?: number;
  unit?: string;
  /** Vermenigvuldiger tussen opgeslagen waarde en weergave (bijv. 100 voor m → cm). */
  scale?: number;
  className?: string;
  ariaLabel?: string;
  testId?: string;
  disabled?: boolean;
}

/**
 * Getalveld dat komma's en punten accepteert. De waarde wordt pas doorgegeven bij Enter,
 * de pijltjestoetsen of het verlaten van het veld, zodat half getypte getallen niets verstoren.
 */
export function NumberField({ label, value, onCommit, min, max, step = 0.1, decimals = 2, unit, scale = 1, className, ariaLabel, testId, disabled }: NumberFieldProps) {
  const id = useId();
  const format = (v: number) => (v * scale).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: decimals, useGrouping: false });
  const [draft, setDraft] = useState(format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(format(value));
  }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

  const commit = (text: string) => {
    const parsed = parseNumber(text);
    if (parsed === null) {
      setDraft(format(value));
      return;
    }
    const next = clamp(parsed / scale);
    setDraft(format(next));
    if (Math.abs(next - value) > 1e-9) onCommit(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit(draft);
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(format(value));
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = parseNumber(draft);
      const current = base === null ? value : base / scale;
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
      const next = clamp(Math.round((current + delta) * 1e6) / 1e6);
      setDraft(format(next));
      if (Math.abs(next - value) > 1e-9) onCommit(next);
    }
  };

  return (
    <label htmlFor={id} className={classNames('block min-w-0', className)}>
      {label && <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</span>}
      <span
        className={classNames(
          'flex h-9 items-center rounded-lg border bg-white px-2.5 transition',
          focused ? 'border-ink-900 ring-2 ring-ink-900/10' : 'border-sand-300 hover:border-ink-300',
          disabled && 'opacity-50',
        )}
      >
        <input
          id={id}
          data-testid={testId}
          aria-label={ariaLabel ?? label}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          className="tabular w-full min-w-0 bg-transparent text-sm font-medium text-ink-900 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            setFocused(true);
            e.currentTarget.select();
          }}
          onBlur={() => {
            setFocused(false);
            commit(draft);
          }}
          onKeyDown={onKeyDown}
        />
        {unit && <span className="ml-1 shrink-0 text-xs font-medium text-ink-400">{unit}</span>}
      </span>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  size?: 'sm' | 'md';
  tone?: 'light' | 'dark';
  ariaLabel: string;
  className?: string;
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', tone = 'light', ariaLabel, className }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={classNames('inline-flex rounded-xl p-1', tone === 'dark' ? 'bg-white/10' : 'bg-sand-200/70', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={classNames(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold transition',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              tone === 'dark'
                ? active
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-200 hover:text-white'
                : active
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg py-1.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink-800">{label}</span>
        {hint && <span className="block text-xs text-ink-400">{hint}</span>}
      </span>
      <span className={classNames('relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-ink-900' : 'bg-sand-300')}>
        <span className={classNames('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

// ─────────────────────────────────────── Venster ───────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  testId?: string;
}

export function Modal({ open, onClose, title, children, wide, testId }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 animate-fade bg-ink-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        className={classNames(
          'relative flex max-h-[92dvh] w-full animate-pop flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop outline-none sm:rounded-3xl',
          wide ? 'sm:max-w-4xl' : 'sm:max-w-lg',
        )}
      >
        <button
          type="button"
          aria-label="Sluiten"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-ink-600 shadow-card transition hover:bg-sand-100 hover:text-ink-900"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Meldingen ───────────────────────────────────────

const TOAST_ICON: Record<Toast['tone'], ReactNode> = {
  success: <Check size={16} />,
  info: <Info size={16} />,
  warning: <TriangleAlert size={16} />,
  error: <CircleAlert size={16} />,
};
const TOAST_TONE: Record<Toast['tone'], string> = {
  success: 'bg-volt text-volt-ink',
  info: 'bg-info text-white',
  warning: 'bg-warn text-ink-900',
  error: 'bg-danger text-white',
};

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[8.25rem] z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-md animate-pop items-start gap-3 rounded-2xl bg-ink-900 p-3 pr-2 text-white shadow-pop"
        >
          <span className={classNames('mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full', TOAST_TONE[t.tone])}>
            {TOAST_ICON[t.tone]}
          </span>
          <span className="min-w-0 flex-1 py-0.5">
            <span className="block text-sm font-semibold">{t.title}</span>
            {t.detail && <span className="mt-0.5 block text-[13px] leading-snug text-ink-200">{t.detail}</span>}
          </span>
          <button type="button" aria-label="Melding sluiten" onClick={() => dismiss(t.id)} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/10 hover:text-white">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────── Hulpjes ───────────────────────────────────────

/** Volgt een CSS media query. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{children}</h3>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-5 py-8 text-center">
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-white text-ink-500 shadow-card">{icon}</span>
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {children && <div className="mt-1 text-[13px] leading-relaxed text-ink-500">{children}</div>}
    </div>
  );
}
