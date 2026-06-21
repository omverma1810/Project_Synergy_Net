'use client';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SynergyWordmark } from './Brand';

const highlights = [
  { value: '16+', label: 'Global territories modelled', tone: 'text-synergy-cyan' },
  { value: '60%', label: 'Top cash rebate (Saudi Arabia)', tone: 'text-synergy-gold' },
  { value: '<10s', label: 'Budget-to-incentive analysis', tone: 'text-synergy-violet' },
];

const marquee = [
  'United Kingdom · 25.5%',
  'Ireland · 32%',
  'Canary Islands · 50%',
  'Saudi Arabia · 60%',
  'Belgium · up to 66%',
  'Australia · 30%',
  'Hungary · 30%',
  'Morocco · 30%',
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Brand / storytelling panel ── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-synergy-darker grain p-12">
        {/* Animated aurora blobs */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-synergy-cyan/20 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-0 right-0 w-[24rem] h-[24rem] rounded-full bg-synergy-violet/20 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <SynergyWordmark size="base" />
        </motion.div>

        <div className="relative">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="eyebrow mb-4"
          >
            Media · Fintech Intelligence
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight text-synergy-text"
          >
            Global production finance,
            <br />
            <span className="gradient-text-animated">engineered in seconds.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-5 text-synergy-muted max-w-md leading-relaxed"
          >
            Map any budget to dynamic global incentives across Europe, EMEA &amp; Asia.
            Rank the top territories by net economic yield — with treaties, stacking, and
            financing baked in.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 grid grid-cols-3 gap-4 max-w-md"
          >
            {highlights.map((h) => (
              <div key={h.label} className="glass-card-light p-4">
                <div className={`text-2xl font-bold ${h.tone}`}>{h.value}</div>
                <div className="mt-1 text-[11px] leading-snug text-synergy-muted">{h.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scrolling territory marquee */}
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <motion.div
            className="flex gap-3 whitespace-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          >
            {[...marquee, ...marquee].map((m, i) => (
              <span key={i} className="badge-muted shrink-0">
                {m}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="relative flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="pointer-events-none absolute inset-0 lg:hidden overflow-hidden">
          <div className="absolute -top-40 -left-20 w-80 h-80 bg-synergy-cyan/10 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative w-full max-w-md"
        >
          <div className="lg:hidden mb-8 flex justify-center">
            <SynergyWordmark size="base" />
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
