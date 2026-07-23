'use client';
/* eslint-disable @next/next/no-img-element */

/**
 * SynergyMark — the Synergy Media Labs peacock-feather circuit mark.
 * Served from /public/logo-mark.jpg (square crop of the master logo).
 */
export function SynergyMark({
  size = 28,
}: {
  size?: number;
  /** Accepted for API compatibility; the raster logo has no animation. */
  animate?: boolean;
}) {
  return (
    <img
      src="/logo-mark.jpg"
      alt="Synergy Media Labs"
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover ring-1 ring-synergy-cyan/30"
    />
  );
}

/**
 * SynergyLogo — the full Synergy Media Labs lockup (feather + wordmark).
 * Use on auth screens, marketing panels, and anywhere the full brand fits.
 */
export function SynergyLogo({ width = 260 }: { width?: number }) {
  return (
    <img
      src="/logo.jpg"
      alt="Synergy Media Labs — A Synergy Media Corporation Company"
      width={width}
      className="rounded-xl object-contain"
    />
  );
}

export function SynergyWordmark({
  size = 'base',
  withMark = true,
}: {
  size?: 'sm' | 'base' | 'lg';
  withMark?: boolean;
}) {
  const text = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-2xl',
  }[size];
  const mark = { sm: 26, base: 32, lg: 44 }[size];

  return (
    <div className="flex items-center gap-2.5">
      {withMark && <SynergyMark size={mark} />}
      <div className="flex flex-col leading-tight">
        <span className={`font-bold tracking-wide ${text} text-synergy-text`}>
          SYNERGY <span className="gradient-text">MEDIA LABS</span>
        </span>
        <span className="text-[9px] tracking-widest uppercase text-synergy-muted">
          A Synergy Media Corporation Company
        </span>
      </div>
    </div>
  );
}
