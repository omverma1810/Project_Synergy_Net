'use client';
import { useEffect, useState } from 'react';
import { territories } from '@/lib/api';

interface Territory {
  id: number;
  name: string;
  country_code: string;
  incentive_type: string;
  base_percentage: string;
  min_spend?: string;
  max_rebate_cap?: string;
  currency: string;
  is_capped: boolean;
  is_stackable: boolean;
  description?: string;
  status: string;
}

export default function TerritoriesPage() {
  const [territoryList, setTerritoryList] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    territories
      .list()
      .then((data) => setTerritoryList(data.results ?? data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-synergy-muted">Loading territories...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-synergy-text">Territories</h1>
        <p className="text-synergy-muted mt-1">Available film incentive jurisdictions</p>
      </div>

      {territoryList.length === 0 ? (
        <div className="bg-synergy-card rounded-lg border border-synergy-border p-12 text-center">
          <p className="text-synergy-muted">No territories found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {territoryList.map((t) => (
            <div
              key={t.id}
              className="bg-synergy-card rounded-lg border border-synergy-border p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-synergy-text">{t.name}</h3>
                  <p className="text-xs text-synergy-muted mt-0.5">{t.country_code}</p>
                </div>
                <span className="text-2xl font-bold text-synergy-cyan shrink-0 ml-2">
                  {t.base_percentage}%
                </span>
              </div>

              <p className="text-sm text-synergy-muted mb-4">
                {t.incentive_type.replace(/_/g, ' ')}
              </p>

              <div className="space-y-2 text-sm flex-1">
                {t.min_spend && (
                  <div className="flex justify-between">
                    <span className="text-synergy-muted">Min Spend</span>
                    <span className="text-synergy-text">
                      {Number(t.min_spend).toLocaleString()} {t.currency}
                    </span>
                  </div>
                )}
                {t.is_capped && t.max_rebate_cap && (
                  <div className="flex justify-between">
                    <span className="text-synergy-muted">Cap</span>
                    <span className="text-synergy-text">
                      {Number(t.max_rebate_cap).toLocaleString()} {t.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-synergy-muted">Stackable</span>
                  <span className={t.is_stackable ? 'text-synergy-green' : 'text-synergy-muted'}>
                    {t.is_stackable ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {t.description && (
                <p className="text-xs text-synergy-muted mt-4 line-clamp-2">{t.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
