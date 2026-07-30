'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, ChevronRightIcon, ChevronLeftIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { api, Territory } from '@/lib/api';
import Layout from '@/components/Layout';

const step1Schema = z.object({
  title: z.string().min(2, 'Title required'),
  type: z.enum(['FEATURE', 'TV_SERIES', 'DOCUMENTARY', 'COMMERCIAL']),
  genre: z.string().min(1, 'Genre required'),
  language: z.string().min(1, 'Language required'),
  synopsis: z.string().optional(),
  total_budget: z.string().min(1, 'Budget required'),
  currency: z.string().length(3),
  target_territory: z.string().optional(),
  shoot_start_date: z.string().optional(),
  shoot_end_date: z.string().optional(),
  shoot_duration_days: z.string().optional(),
});
type Step1Data = z.infer<typeof step1Schema>;

interface SpendRow { category: string; amount: string; }
interface CastRow { role: string; name: string; status: string; }
interface TimelineRow { milestone: string; date: string; }

const STEPS = ['Basic Info', 'Spend Estimates', 'Cast & Schedule', 'Files & Submit'];

const CAST_STATUS_OPTIONS = ['Attached', 'In Talks', 'Potential'];

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

const DEFAULT_ESTIMATES: SpendRow[] = [
  { category: 'Local Crew', amount: '' },
  { category: 'Equipment Rental', amount: '' },
  { category: 'Location Fees', amount: '' },
  { category: 'Post Production', amount: '' },
  { category: 'Set Construction', amount: '' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [estimates, setEstimates] = useState<SpendRow[]>(DEFAULT_ESTIMATES);
  const [cast, setCast] = useState<CastRow[]>([{ role: '', name: '', status: 'Attached' }]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([{ milestone: 'Shoot Start', date: '' }]);
  const [residencyConfirmed, setResidencyConfirmed] = useState(false);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [territories, setTerritories] = useState<Territory[]>([]);

  useEffect(() => {
    api.territories.list().then(setTerritories).catch(() => {});
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { currency: 'USD', language: 'English', type: 'FEATURE', genre: 'drama' },
  });

  const next = (data?: Step1Data) => {
    if (data) setStep1Data(data);
    setDir(1);
    setStep(s => s + 1);
  };
  const back = () => { setDir(-1); setStep(s => s - 1); };

  const handleFinalSubmit = async () => {
    if (!step1Data) return;
    setSubmitting(true);
    setError('');
    try {
      const spend_estimates = estimates.reduce<Record<string, number>>((acc, e) => {
        if (e.category && e.amount) acc[e.category] = parseFloat(e.amount) || 0;
        return acc;
      }, {});

      const castRows = cast.filter(c => c.name.trim());
      const cast_crew_info = castRows.length
        ? { cast: castRows.map(c => ({ role: c.role || 'Role TBD', name: c.name, status: c.status })) }
        : {};

      const timelineRows = timeline.filter(t => t.milestone.trim() && t.date.trim());
      const production_timeline = timelineRows.reduce<Record<string, string>>((acc, t) => {
        acc[t.milestone] = t.date;
        return acc;
      }, {});

      const project = await api.projects.createJson({
        title: step1Data.title,
        type: step1Data.type,
        genre: step1Data.genre.toLowerCase(),
        language: step1Data.language,
        synopsis: step1Data.synopsis || '',
        total_budget: step1Data.total_budget,
        currency: step1Data.currency,
        shoot_start_date: step1Data.shoot_start_date || null,
        shoot_end_date: step1Data.shoot_end_date || null,
        shoot_duration_days: step1Data.shoot_duration_days ? parseInt(step1Data.shoot_duration_days) : null,
        target_territory: step1Data.target_territory ? parseInt(step1Data.target_territory) : null,
        spend_estimates,
        cast_crew_info,
        production_timeline,
        creative_staff_local_resident: residencyConfirmed,
      });

      if (budgetFile) {
        await api.projects.uploadBudget(project.id, budgetFile).catch(() => {});
      }
      toast.success(`"${project.title}" created`);
      router.push(`/projects/${project.id}`);
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Failed to create project';
      setError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  };

  const spendTotal = estimates.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="eyebrow mb-1.5">Producer Intake</p>
          <h1 className="page-title">New Project</h1>
          <p className="text-synergy-muted text-sm mt-1.5">Set up your production for territory analysis</p>
        </div>

        {/* Steps */}
        <div className="flex items-center mb-10 gap-0">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center shrink-0">
                <motion.div
                  animate={{ scale: i === step ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={[
                    'h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                    i < step ? 'bg-gradient-to-br from-synergy-green to-emerald-600 text-white shadow-[0_0_16px_-4px_rgba(52,211,153,0.6)]' :
                    i === step ? 'bg-gradient-cyan text-synergy-darker shadow-glow-cyan' :
                    'bg-synergy-card border border-synergy-border text-synergy-muted',
                  ].join(' ')}
                >
                  {i < step ? <CheckIcon className="h-4 w-4" /> : i + 1}
                </motion.div>
                <span className={`text-[10px] sm:text-xs mt-1.5 text-center leading-tight font-medium ${i === step ? 'text-synergy-cyan' : i < step ? 'text-synergy-green' : 'text-synergy-muted'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-0.5 flex-1 mx-3 mb-5 rounded-full bg-synergy-border overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-synergy-green to-synergy-cyan"
                    initial={false}
                    animate={{ width: i < step ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            {step === 0 && (
              <motion.form
                key="s1"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                onSubmit={handleSubmit(next)}
                className="glass-card p-6 space-y-4"
              >
                <div>
                  <label className="form-label">Project Title *</label>
                  <input {...register('title')} placeholder="Desert Wind" className="form-input" />
                  {errors.title && <p className="mt-1 text-xs text-synergy-red">{errors.title.message}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Type *</label>
                    <select {...register('type')} className="form-select">
                      <option value="FEATURE">Feature Film</option>
                      <option value="TV_SERIES">TV Series</option>
                      <option value="DOCUMENTARY">Documentary</option>
                      <option value="COMMERCIAL">Commercial</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Genre *</label>
                    <select {...register('genre')} className="form-select">
                      {['action', 'animation', 'comedy', 'documentary', 'drama', 'horror', 'sci_fi', 'streaming', 'thriller'].map(g => (
                        <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1).replace('_', '-')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Language</label>
                    <input {...register('language')} placeholder="English" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Currency</label>
                    <select {...register('currency')} className="form-select">
                      {['USD', 'EUR', 'GBP', 'AUD', 'CAD'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Total Budget *</label>
                  <input {...register('total_budget')} type="number" placeholder="2500000" className="form-input" />
                  {errors.total_budget && <p className="mt-1 text-xs text-synergy-red">{errors.total_budget.message}</p>}
                </div>
                <div>
                  <label className="form-label">Shoot Location (incentive territory)</label>
                  <select {...register('target_territory')} className="form-select">
                    <option value="">Decide later / run analysis to compare</option>
                    {territories.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {parseFloat(t.base_percentage).toFixed(0)}%{t.is_stackable && parseFloat(t.provincial_percentage) > 0 ? ` (+${parseFloat(t.provincial_percentage).toFixed(0)}%)` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-synergy-muted">Sets the default rebate program for your financial model. You can compare all territories later.</p>
                </div>
                <div>
                  <label className="form-label">Synopsis</label>
                  <textarea {...register('synopsis')} rows={3} placeholder="Brief description…" className="form-input resize-none" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Shoot Start</label>
                    <input {...register('shoot_start_date')} type="date" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Shoot End</label>
                    <input {...register('shoot_end_date')} type="date" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Days</label>
                    <input {...register('shoot_duration_days')} type="number" placeholder="45" className="form-input" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn-primary flex items-center gap-2">
                    Continue <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </motion.form>
            )}

            {step === 1 && (
              <motion.div
                key="s2"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                className="glass-card p-6"
              >
                <p className="text-sm text-synergy-muted mb-4">
                  Enter estimated spend per category. This powers instant analysis without a budget file.
                </p>
                <div className="space-y-2 mb-4">
                  {estimates.map((est, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={est.category}
                        onChange={e => setEstimates(prev => prev.map((r, j) => j === i ? { ...r, category: e.target.value } : r))}
                        placeholder="Category"
                        className="form-input flex-1"
                      />
                      <input
                        value={est.amount}
                        onChange={e => setEstimates(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                        type="number"
                        placeholder="Amount"
                        className="form-input w-36"
                      />
                      <button onClick={() => setEstimates(prev => prev.filter((_, j) => j !== i))}
                        className="text-synergy-muted hover:text-synergy-red transition-colors text-xl leading-none w-6">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => setEstimates(prev => [...prev, { category: '', amount: '' }])}
                    className="btn-secondary text-xs">
                    + Add Row
                  </button>
                  <div className="text-right">
                    <p className="text-xs text-synergy-muted">Estimated qualified spend</p>
                    <p className="text-lg font-bold gradient-text">
                      {spendTotal.toLocaleString('en-US', { style: 'currency', currency: step1Data?.currency || 'USD', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between">
                  <button onClick={back} className="btn-secondary flex items-center gap-2">
                    <ChevronLeftIcon className="h-4 w-4" /> Back
                  </button>
                  <button onClick={() => next()} className="btn-primary flex items-center gap-2">
                    Continue <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s3"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                className="glass-card p-6"
              >
                <p className="text-sm text-synergy-muted mb-4">
                  Add cast and key production milestones — these populate the Cast and Schedule
                  sections of your Business Plan and Pitch Deck automatically.
                </p>

                <p className="form-label mb-2">Cast</p>
                <div className="space-y-2 mb-3">
                  {cast.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={c.role}
                        onChange={e => setCast(prev => prev.map((r, j) => j === i ? { ...r, role: e.target.value } : r))}
                        placeholder="Role (e.g. Lead)"
                        className="form-input flex-1"
                      />
                      <input
                        value={c.name}
                        onChange={e => setCast(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                        placeholder="Actor name"
                        className="form-input flex-1"
                      />
                      <select
                        value={c.status}
                        onChange={e => setCast(prev => prev.map((r, j) => j === i ? { ...r, status: e.target.value } : r))}
                        className="form-select w-32"
                      >
                        {CAST_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => setCast(prev => prev.filter((_, j) => j !== i))}
                        className="text-synergy-muted hover:text-synergy-red transition-colors text-xl leading-none w-6">×</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setCast(prev => [...prev, { role: '', name: '', status: 'Potential' }])}
                  className="btn-secondary text-xs mb-6">
                  + Add Cast Member
                </button>

                <p className="form-label mb-2">Production Timeline</p>
                <div className="space-y-2 mb-3">
                  {timeline.map((t, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={t.milestone}
                        onChange={e => setTimeline(prev => prev.map((r, j) => j === i ? { ...r, milestone: e.target.value } : r))}
                        placeholder="Milestone (e.g. Principal Photography)"
                        className="form-input flex-1"
                      />
                      <input
                        value={t.date}
                        onChange={e => setTimeline(prev => prev.map((r, j) => j === i ? { ...r, date: e.target.value } : r))}
                        type="date"
                        className="form-input w-44"
                      />
                      <button onClick={() => setTimeline(prev => prev.filter((_, j) => j !== i))}
                        className="text-synergy-muted hover:text-synergy-red transition-colors text-xl leading-none w-6">×</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTimeline(prev => [...prev, { milestone: '', date: '' }])}
                  className="btn-secondary text-xs mb-6">
                  + Add Milestone
                </button>

                <label className="flex items-start gap-3 rounded-xl border border-synergy-border/50 bg-white/[0.03] p-4 cursor-pointer mb-6">
                  <input
                    type="checkbox"
                    checked={residencyConfirmed}
                    onChange={e => setResidencyConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-synergy-cyan"
                  />
                  <span className="text-sm text-synergy-text">
                    Principal cast, writer &amp; director are confirmed local / EEA tax residents
                    <span className="block text-xs text-synergy-muted mt-1">
                      Unlocks the creative-staff rebate eligibility in your financial model. Leave unchecked if residency isn&apos;t confirmed yet — you can update this later.
                    </span>
                  </span>
                </label>

                <div className="flex justify-between">
                  <button onClick={back} className="btn-secondary flex items-center gap-2">
                    <ChevronLeftIcon className="h-4 w-4" /> Back
                  </button>
                  <button onClick={() => next()} className="btn-primary flex items-center gap-2">
                    Continue <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s4"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22 }}
                className="glass-card p-6 space-y-5"
              >
                <div>
                  <label className="form-label">Budget File (PDF / CSV / XLSX)</label>
                  <label className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-synergy-border hover:border-synergy-cyan/50 hover:bg-synergy-cyan/[0.03] transition-all cursor-pointer py-8 px-4 text-center">
                    <DocumentArrowUpIcon className="h-8 w-8 text-synergy-muted group-hover:text-synergy-cyan transition-colors" />
                    {budgetFile ? (
                      <span className="text-sm text-synergy-cyan font-medium">{budgetFile.name}</span>
                    ) : (
                      <>
                        <span className="text-sm text-synergy-text font-medium">Drop your budget here or click to browse</span>
                        <span className="text-xs text-synergy-muted">PDF, CSV or XLSX · optional if spend estimates provided</span>
                      </>
                    )}
                    <input type="file" accept=".pdf,.csv,.xlsx"
                      onChange={e => setBudgetFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Review summary */}
                {step1Data && (
                  <div className="rounded-xl bg-white/[0.03] border border-synergy-border/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-synergy-text mb-1">Review</p>
                    {[
                      ['Title', step1Data.title],
                      ['Type · Genre', `${step1Data.type.replace('_', ' ').toLowerCase()} · ${step1Data.genre}`],
                      ['Total budget', Number(step1Data.total_budget).toLocaleString('en-US', { style: 'currency', currency: step1Data.currency, maximumFractionDigits: 0 })],
                      ['Shoot location', step1Data.target_territory ? (territories.find(t => String(t.id) === step1Data.target_territory)?.name || '—') : 'Decide later'],
                      ['Spend categories', `${estimates.filter(e => e.category && e.amount).length} · ${spendTotal.toLocaleString('en-US', { style: 'currency', currency: step1Data.currency, maximumFractionDigits: 0 })}`],
                      ['Cast attached', `${cast.filter(c => c.name.trim()).length}`],
                      ['Milestones', `${timeline.filter(t => t.milestone.trim() && t.date.trim()).length}`],
                      ['Residency confirmed', residencyConfirmed ? 'Yes' : 'Not yet'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-synergy-muted">{k}</span>
                        <span className="text-synergy-text font-medium capitalize">{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-synergy-red/10 border border-synergy-red/20 px-3 py-2 text-sm text-synergy-red">{error}</div>
                )}

                <div className="flex justify-between pt-2">
                  <button onClick={back} className="btn-secondary flex items-center gap-2">
                    <ChevronLeftIcon className="h-4 w-4" /> Back
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="btn-primary flex items-center gap-2"
                  >
                    {submitting ? (
                      <><span className="h-4 w-4 border-2 border-synergy-dark/30 border-t-synergy-dark rounded-full animate-spin" /> Creating…</>
                    ) : (
                      <><CheckIcon className="h-4 w-4" /> Create Project</>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
