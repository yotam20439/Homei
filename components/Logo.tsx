/** HOMEi logo, vector rebuild of the original artwork. Roof and house are separate groups so they can animate. */
export function LogoMark({ size = 40, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg className={className} width={size} height={(size * 330) / 340} viewBox="0 0 340 330" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g className="logo-house">
        <polygon points="31,118 178,190 178,312 31,240" fill="#D6B0DC" />
        <polygon points="31,118 94,94 178,190 178,214 31,140" fill="#C59ACF" />
        <polygon points="178,214 312,148 312,240 178,312" fill="#6A5574" />
        <polygon points="178,214 312,148 312,162 178,230" fill="#5A4664" />
      </g>
      <g className="logo-roof">
        <polygon points="14,118 94,94 94,110 14,136" fill="#CFA4DE" />
        <polygon points="14,118 160,44 235,11 94,94" fill="#D9B7E8" />
        <polygon points="94,94 235,11 326,126 180,201" fill="#C9B9E8" />
        <polygon points="180,201 326,126 326,142 180,218" fill="#B29BCF" />
        <polygon points="94,94 180,201 180,218 94,110" fill="#BBA3D6" />
      </g>
    </svg>
  );
}

export function LogoLockup({ size = 34, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="logo-lockup" dir="ltr">
      <LogoMark size={size} />
      <span className="logo-word" style={{ fontSize: size * 0.82, ...(light ? { color: "#463A5E" } : {}) }}>Homei</span>
    </span>
  );
}
