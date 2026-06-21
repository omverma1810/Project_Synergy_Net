'use client';
import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/** Smoothly counts up to `value` when it mounts or changes. */
export function AnimatedNumber({ value, format, duration = 1.2, className }: Props) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <span className={className}>{format ? format(display) : Math.round(display).toLocaleString()}</span>;
}
