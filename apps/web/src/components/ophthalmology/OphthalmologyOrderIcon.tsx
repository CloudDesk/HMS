type OrderIconKind = 'pill' | 'clipboard' | 'activity' | 'plus' | 'check';

/** Inline line icons keep the order workspace independent of icon-font loading. */
export function OphthalmologyOrderIcon({ kind }: { kind: OrderIconKind }) {
  return (
    <svg className="oph-order-line-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'pill' && <><path d="M10.5 20.5a6.36 6.36 0 0 1-9-9l10-10a6.36 6.36 0 0 1 9 9Z" transform="translate(1 1) scale(.91)" /><path d="m8.5 8.5 7 7" /></>}
      {kind === 'clipboard' && <><rect x="5" y="4" width="14" height="18" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 11h1m3 0h3m-7 5h1m3 0h3" /></>}
      {kind === 'activity' && <path d="M2 12h4l3-9 5 18 3-9h5" />}
      {kind === 'plus' && <path d="M12 4v16M4 12h16" />}
      {kind === 'check' && <path d="m4 12 5 5L20 6" />}
    </svg>
  );
}
