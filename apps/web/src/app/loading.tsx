import { SynergyMark } from '@/components/Brand';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="animate-float">
        <SynergyMark size={48} animate={false} />
      </div>
      <div className="flex items-center gap-2 text-synergy-muted text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-synergy-cyan animate-glow-pulse" />
        Loading Synergy Net…
      </div>
    </div>
  );
}
