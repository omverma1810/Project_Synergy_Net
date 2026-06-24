'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, GlobeAltIcon, ChevronDownIcon, MapIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import { api, Territory, TerritoryDetail, PolicyAlert } from '@/lib/api';
import Layout from '@/components/Layout';

// Leaflet touches `window`, so load the map client-side only.
const TerritoryMap = dynamic(() => import('@/components/TerritoryMap'), {
  ssr: false,
  loading: () => <div className="h-[420px] skeleton rounded-2xl" />,
});

const REGIONS = ['All', 'Western Europe', 'Eastern Europe', 'Middle East', 'North Africa', 'Asia Pacific', 'North America', 'Southern Europe'];

const INCENTIVE_COLORS: Record<string, string> = {
  CASH_REBATE: 'badge-green',
  TAX_CREDIT: 'badge-cyan',
  TAX_SHELTER: 'badge-orange',
  GRANT: 'badge-muted',
};

const FLAGS: Record<string, string> = {
  'SA': '🇸🇦', 'BE': '🇧🇪', 'GB': '🇬🇧', 'GB_HETV': '🇬🇧',
  'IE': '🇮🇪', 'ES_CI': '🇪🇸', 'HU': '🇭🇺', 'RS': '🇷🇸',
  'AU': '🇦🇺', 'AU_PDV': '🇦🇺', 'AE': '🇦🇪',
  'CA': '🇨🇦', 'CA_BC': '🇨🇦', 'MA': '🇲🇦', 'PL': '🇵🇱', 'RO': '🇷🇴',
};

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [alerts, setAlerts] = useState<PolicyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All');
  const [genre, setGenre] = useState('All');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, TerritoryDetail>>({});
  const [view, setView] = useState<'grid' | 'map'>('grid');

  useEffect(() => {
    Promise.all([
      api.territories.list(),
      api.territories.alerts().catch(() => [] as PolicyAlert[]),
    ]).then(([t, a]) => {
      setTerritories(Array.isArray(t) ? t : []);
      setAlerts(Array.isArray(a) ? a : []);
    }).finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (t: Territory) => {
    if (expanded === t.id) { setExpanded(null); return; }
    setExpanded(t.id);
    if (!details[t.id]) {
      const d = await api.territories.get(t.id).catch(() => null);
      if (d) setDetails(prev => ({ ...prev, [t.id]: d }));
    }
  };

  const filtered = territories.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = t.name.toLowerCase().includes(q) || t.country_code.toLowerCase().includes(q);
    const matchRegion = region === 'All' || t.region === region;
    const matchGenre = genre === 'All' ||
      (genre === 'animation' && t.animation_eligible) ||
      (genre === 'documentary' && t.documentary_eligible) ||
      (genre === 'streaming' && t.streaming_eligible) ||
      (genre === 'sci_fi' && t.sci_fi_eligible);
    return matchSearch && matchRegion && matchGenre;
  });

  if (loading) {
    return (
      <Layout>
        <div className="h-8 w-48 skeleton mb-2" />
        <div className="h-4 w-64 skeleton mb-8" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-52 skeleton rounded-2xl" />)}
        </div>
      </Layout>
    );
  }

  const topRate = territories.reduce((max, t) => Math.max(max, parseFloat(t.base_percentage)), 0);

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">Global Incentive Atlas</p>
          <h1 className="page-title">Territories</h1>
          <p className="text-synergy-muted text-sm mt-1.5">
            {territories.length} active programs · top rate{' '}
            <span className="gradient-text-gold font-semibold">{topRate.toFixed(0)}%</span>
          </p>
        </div>
        <div className="flex gap-1 bg-synergy-card/40 border border-synergy-border/40 rounded-xl p-1">
          {([['grid', 'Grid', Squares2X2Icon], ['map', 'Map', MapIcon]] as const).map(([mode, label, Icon]) => (
            <button key={mode} onClick={() => setView(mode)}
              className={[
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                view === mode ? 'text-synergy-darker' : 'text-synergy-muted hover:text-synergy-text',
              ].join(' ')}
            >
              {view === mode && (
                <motion.span layoutId="territoryView" className="absolute inset-0 rounded-lg bg-gradient-cyan shadow-glow-cyan"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {alerts.map(alert => (
            <div key={alert.id} className="glass-card-cyan px-3 py-2 flex items-center gap-2 shrink-0 text-xs whitespace-nowrap">
              <span className="badge-cyan">Alert</span>
              <span className="text-synergy-text font-medium">{alert.title}</span>
              {alert.previous_value && alert.new_value && (
                <span className="text-synergy-muted">
                  <span className="line-through">{alert.previous_value}</span>
                  {' → '}
                  <span className="text-synergy-cyan">{alert.new_value}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative w-full sm:flex-1 sm:min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-synergy-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search territories…" className="form-input pl-10" />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <select value={region} onChange={e => setRegion(e.target.value)} className="form-select flex-1 sm:flex-none sm:w-auto">
            {REGIONS.map(r => <option key={r}>{r}</option>)}
          </select>
          <select value={genre} onChange={e => setGenre(e.target.value)} className="form-select flex-1 sm:flex-none sm:w-auto">
            {[['All', 'All Genres'], ['animation', 'Animation'], ['documentary', 'Documentary'], ['streaming', 'Streaming'], ['sci_fi', 'Sci-Fi']].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {view === 'map' && (
        <div className="glass-card overflow-hidden p-1.5 mb-6">
          <div className="h-[420px] sm:h-[520px] rounded-xl overflow-hidden">
            <TerritoryMap territories={filtered} onSelect={(id) => { setView('grid'); setExpanded(id); }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[11px] text-synergy-muted">
            <span className="font-medium text-synergy-text">Rebate rate:</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#a78bfa' }} /> &lt;25%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#22d3ee' }} /> 25–32%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#34d399' }} /> 33–49%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f5c451' }} /> 50%+</span>
            <span className="ml-auto">Click a territory to view its details</span>
          </div>
        </div>
      )}

      <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${view === 'map' ? 'hidden' : ''}`}>
        <AnimatePresence>
          {filtered.map(t => (
            <motion.div key={t.id} layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={`glass-card overflow-hidden transition-all duration-300 ${
                expanded === t.id
                  ? 'border-synergy-cyan/40 shadow-glow-cyan'
                  : 'hover:border-synergy-cyan/30 hover:shadow-glow-cyan hover:-translate-y-0.5'
              }`}
            >
              <div className="p-5 cursor-pointer" onClick={() => toggleExpand(t)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl drop-shadow-lg">{FLAGS[t.country_code] || '🌍'}</span>
                    <div>
                      <p className="font-semibold text-synergy-text text-sm leading-tight">{t.name}</p>
                      <p className="text-xs text-synergy-muted">{t.region}</p>
                    </div>
                  </div>
                  <motion.div animate={{ rotate: expanded === t.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDownIcon className="h-4 w-4 text-synergy-muted" />
                  </motion.div>
                </div>

                <div className="mb-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold gradient-text tracking-tight">{parseFloat(t.base_percentage).toFixed(1)}%</span>
                  <span className="text-synergy-muted text-sm">rebate</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={INCENTIVE_COLORS[t.incentive_type] || 'badge-muted'}>
                    {t.incentive_type.replace('_', ' ')}
                  </span>
                  {t.is_stackable && <span className="badge-orange">Stackable</span>}
                  {t.loan_against_rebate_available && <span className="badge-green">Financing</span>}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {[['Anim', t.animation_eligible], ['Doc', t.documentary_eligible], ['Stream', t.streaming_eligible], ['Sci-Fi', t.sci_fi_eligible]].map(([label, active]) => (
                    <span key={label as string} className={`badge ${active ? 'badge-cyan' : 'badge-muted'} text-[10px]`}>{label as string}</span>
                  ))}
                </div>

                <div className="flex justify-between mt-3 text-xs text-synergy-muted">
                  <span>{t.rebate_timing_months_min}–{t.rebate_timing_months_max} mo payout</span>
                  {t.min_spend && (
                    <span>Min {parseFloat(t.min_spend).toLocaleString('en-US', { style: 'currency', currency: t.currency, maximumFractionDigits: 0 })}</span>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {expanded === t.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-synergy-border/50"
                  >
                    <div className="p-5 space-y-4">
                      {details[t.id]?.description && (
                        <p className="text-xs text-synergy-muted leading-relaxed">{details[t.id].description}</p>
                      )}
                      {details[t.id]?.compliance_items?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-synergy-text mb-2">Compliance Requirements</p>
                          <div className="space-y-1.5">
                            {details[t.id].compliance_items.slice(0, 4).map(item => (
                              <div key={item.id} className="flex items-start gap-2 text-xs">
                                <span className={`badge mt-0.5 shrink-0 ${item.is_mandatory ? 'badge-red' : 'badge-muted'} text-[10px]`}>
                                  {item.deadline_type.replace(/_/g, ' ').toLowerCase()}
                                </span>
                                <span className="text-synergy-muted">{item.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {details[t.id]?.partners?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-synergy-text mb-2">Vetted Partners</p>
                          <div className="space-y-1.5">
                            {details[t.id].partners.slice(0, 3).map(p => (
                              <div key={p.id} className="flex items-center gap-2 text-xs">
                                <span className="badge-muted capitalize">{p.partner_type.replace('_', ' ')}</span>
                                <span className="text-synergy-text">{p.name}</span>
                                {p.is_vetted && <span className="badge-green ml-auto">✓</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Local support: film commission, government, associations */}
                      {(t.film_commission || details[t.id]?.government_support || details[t.id]?.local_associations?.length > 0) && (
                        <div className="rounded-lg bg-white/[0.03] border border-synergy-border/40 p-3">
                          <p className="text-xs font-semibold text-synergy-text mb-2 flex items-center gap-1.5">
                            <GlobeAltIcon className="h-3.5 w-3.5 text-synergy-cyan" /> Local Support
                          </p>
                          {t.film_commission && (
                            <p className="text-xs text-synergy-text mb-1">
                              {t.film_commission_url ? (
                                <a href={t.film_commission_url} target="_blank" rel="noopener noreferrer"
                                   className="text-synergy-cyan hover:underline">{t.film_commission} →</a>
                              ) : t.film_commission}
                            </p>
                          )}
                          {details[t.id]?.government_support && (
                            <p className="text-[11px] text-synergy-muted leading-relaxed">{details[t.id].government_support}</p>
                          )}
                          {details[t.id]?.local_associations?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {details[t.id].local_associations.map((a, i) => (
                                a.url ? (
                                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="badge-cyan text-[10px] hover:brightness-110">{a.name}</a>
                                ) : <span key={i} className="badge-muted text-[10px]">{a.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {t.official_url && (
                        <a href={t.official_url} target="_blank" rel="noopener noreferrer"
                          className="text-synergy-cyan text-xs hover:underline">Official Program →</a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <GlobeAltIcon className="h-10 w-10 text-synergy-muted mx-auto mb-4" />
          <p className="text-synergy-muted">No territories match your filters.</p>
        </div>
      )}
    </Layout>
  );
}
