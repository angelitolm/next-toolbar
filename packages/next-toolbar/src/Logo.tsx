// NextToolbar mark: an "N" whose diagonal is the toolbar's glowing primary gradient bar.
// Keep in sync with logo.svg at the package root. The verticals use currentColor so the
// mark follows the theme; logo.svg hardcodes them for its own dark background.
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nt-logo-grad" x1="9" y1="9" x2="23" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C6FF5C" />
          <stop offset="1" stopColor="#5EF5E0" />
        </linearGradient>
        <filter id="nt-logo-glow" x="0" y="0" width="32" height="32" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <rect x="7" y="7" width="4.5" height="18" rx="2.25" fill="currentColor" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="2.25" fill="currentColor" />
      <path d="M10 10 22 22" stroke="url(#nt-logo-grad)" strokeWidth="4.5" strokeLinecap="round" filter="url(#nt-logo-glow)" opacity=".8" />
      <path d="M10 10 22 22" stroke="url(#nt-logo-grad)" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}
