type Props = {
  compact?: boolean
}

export default function AppLogo({ compact = false }: Props) {
  return (
    <div className={compact ? 'app-logo app-logo-compact' : 'app-logo'} aria-label="Submission Hub logo">
      <svg viewBox="0 0 64 64" role="img" focusable="false">
        <defs>
          <linearGradient id="logo-bg" x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.52" stopColor="#F7FBFF" />
            <stop offset="1" stopColor="#F2ECFF" />
          </linearGradient>
          <linearGradient id="logo-corner" x1="42" y1="10" x2="56" y2="25" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#6D5DFB" />
          </linearGradient>
          <linearGradient id="logo-node" x1="16" y1="42" x2="48" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0EA5E9" />
            <stop offset="0.5" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="logo-line" x1="18" y1="39" x2="48" y2="39" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0EA5E9" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
          <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="150%" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#334155" floodOpacity="0.12" />
          </filter>
          <filter id="logo-soft" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.15" />
          </filter>
        </defs>

        <rect x="2.5" y="2.5" width="59" height="59" rx="18" fill="url(#logo-bg)" stroke="rgba(148,163,184,0.22)" />
        <path d="M8 44C19 34 26 38 37 30C48 22 50 19 58 18V61H8V44Z" fill="#DBEAFE" opacity="0.34" />
        <path d="M39 49C47 42 51 38 61 36V61H31C32 57 35 53 39 49Z" fill="#C4B5FD" opacity="0.22" />

        <g filter="url(#logo-shadow)">
          <path d="M18 12H42L52 22V48C52 51.3 49.3 54 46 54H18C14.7 54 12 51.3 12 48V18C12 14.7 14.7 12 18 12Z" fill="rgba(255,255,255,0.92)" stroke="rgba(148,163,184,0.18)" />
          <path d="M42 12V19C42 20.7 43.3 22 45 22H52L42 12Z" fill="url(#logo-corner)" />
          <rect x="20" y="21" width="18" height="3" rx="1.5" fill="#6D8DFB" opacity="0.78" />
          <rect x="20" y="28" width="13" height="3" rx="1.5" fill="#A5B4FC" opacity="0.62" />
        </g>

        <g filter="url(#logo-soft)">
          <path d="M22 42L31 36L42 43" stroke="url(#logo-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M32 38V48" stroke="url(#logo-line)" strokeWidth="3" strokeLinecap="round" fill="none" />
          <circle cx="32" cy="35" r="8.2" fill="rgba(99,102,241,0.16)" />
          <circle cx="32" cy="35" r="5.7" fill="url(#logo-node)" />
          <circle cx="20" cy="43" r="4.3" fill="#0EA5E9" />
          <circle cx="44" cy="43" r="4.3" fill="#8B5CF6" />
          <circle cx="32" cy="50" r="4.3" fill="#3B82F6" />
        </g>
      </svg>
    </div>
  )
}
