/**
 * Taccuino — logo originale: taccuino con rilegatura a spirale e biacca calda.
 * SVG inline (nessuna risorsa esterna), colori della palette dell'app.
 */

export function Logo({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Copertina */}
      <rect x="8" y="6" width="48" height="52" rx="10" fill="var(--primary)" />
      {/* Rilegatura a spirale */}
      <circle cx="18" cy="14" r="2.4" fill="var(--primary-foreground)" />
      <circle cx="18" cy="26" r="2.4" fill="var(--primary-foreground)" />
      <circle cx="18" cy="38" r="2.4" fill="var(--primary-foreground)" />
      <circle cx="18" cy="50" r="2.4" fill="var(--primary-foreground)" />
      {/* Pagina */}
      <rect x="24" y="12" width="28" height="40" rx="5" fill="var(--primary-foreground)" />
      {/* Righe di testo */}
      <rect x="29" y="20" width="18" height="3.4" rx="1.7" fill="var(--primary)" opacity="0.35" />
      <rect x="29" y="28" width="18" height="3.4" rx="1.7" fill="var(--primary)" opacity="0.35" />
      <rect x="29" y="36" width="11" height="3.4" rx="1.7" fill="var(--primary)" opacity="0.35" />
    </svg>
  )
}
