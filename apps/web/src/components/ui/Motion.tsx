'use client';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useRef } from 'react';
import type { ReactNode, MouseEvent } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Staggered container + item variants shared across pages. */
export const stagger: { container: Variants; item: Variants } = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
  },
  item: {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  },
};

/** Fade + lift in when mounted. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * SpotlightCard — a glass card with a cyan glow that tracks the cursor.
 * Gives the dashboard/territory cards a premium, tactile feel.
 */
export function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const mouseX = useMotionValue(-200);
  const mouseY = useMotionValue(-200);
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  const background = useMotionTemplate`radial-gradient(360px circle at ${mouseX}px ${mouseY}px, rgba(34,211,238,0.10), transparent 70%)`;

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => {
        mouseX.set(-200);
        mouseY.set(-200);
      }}
      className={`group relative overflow-hidden ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
