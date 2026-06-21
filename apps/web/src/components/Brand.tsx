'use client';
import { motion } from 'framer-motion';

/**
 * SynergyMark — a cinematic "aperture + network" glyph.
 * Camera-aperture blades fused with connected nodes, evoking
 * film production (aperture) + financial networks (nodes/edges).
 */
export function SynergyMark({ size = 28, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="synergy-grad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id="synergy-core" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#67e8f9" />
          <stop offset="1" stopColor="#22d3ee" />
        </radialGradient>
      </defs>

      {/* Outer aperture ring */}
      <motion.circle
        cx="24" cy="24" r="20"
        stroke="url(#synergy-grad)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="92 34"
        initial={animate ? { rotate: -90, opacity: 0 } : false}
        animate={animate ? { rotate: 270, opacity: 1 } : false}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        style={{ transformOrigin: '24px 24px' }}
      />

      {/* Network nodes around a hexagon */}
      {[
        [24, 7], [38, 15.5], [38, 32.5], [24, 41], [10, 32.5], [10, 15.5],
      ].map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x} cy={y} r="2.4"
          fill="url(#synergy-grad)"
          initial={animate ? { scale: 0, opacity: 0 } : false}
          animate={animate ? { scale: 1, opacity: 1 } : false}
          transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}
        />
      ))}

      {/* Inner edges to the core */}
      {[
        [24, 7], [38, 15.5], [38, 32.5], [24, 41], [10, 32.5], [10, 15.5],
      ].map(([x, y], i) => (
        <motion.line
          key={`l${i}`}
          x1="24" y1="24" x2={x} y2={y}
          stroke="url(#synergy-grad)" strokeWidth="1" opacity="0.35"
          initial={animate ? { pathLength: 0 } : false}
          animate={animate ? { pathLength: 1 } : false}
          transition={{ delay: 0.4 + i * 0.06, duration: 0.5 }}
        />
      ))}

      {/* Pulsing core */}
      <motion.circle
        cx="24" cy="24" r="5"
        fill="url(#synergy-core)"
        initial={animate ? { scale: 0 } : false}
        animate={animate ? { scale: [0, 1.15, 1] } : false}
        transition={{ delay: 0.6, duration: 0.6 }}
      />
      <circle cx="24" cy="24" r="5" fill="url(#synergy-core)" className="animate-glow-pulse" />
    </svg>
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
  const mark = { sm: 22, base: 28, lg: 40 }[size];

  return (
    <div className="flex items-center gap-2.5">
      {withMark && <SynergyMark size={mark} />}
      <span className={`font-bold tracking-wide ${text} text-synergy-text`}>
        SYNERGY <span className="gradient-text">NET</span>
      </span>
    </div>
  );
}
