'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { analysis } from '@/lib/api';

interface AnalysisResult {
  id: number;
  rank: number;
  territory_name: string;
  territory_country: string;
  territory_percentage: string;
  qualified_spend_total: string;
  estimated_rebate: string;
  logistics_premium: string;
  net_benefit: string;
  confidence_score: string;
  currency: string;
}

const RANK_STYLE: Record<number, string> = {
  1: 'bg-synergy-green/20 text-synergy-green',
  2: 'bg-synergy-cyan/20 text-synergy-cyan',
  3: 'bg-synergy-orange/20 text-synergy-orange',
};

function fmt(value: string | number, currency: string) {
  return `${Number(value).toLocaleString()} ${currency}`;
}

export default function AnalysisResults() {
  const searchParams = useSearchParams();
  const analysisId = searchParams.get('id');
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!analysisId) {
      setLoading(false);
      return;
    }
    analysis
      .results(Number(analysisId))
      .then((data) => setResults(data.results ?? data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [analysisId]);

  if (!analysisId) {
    return (
      <div className="text-center py-20">
        <p className="text-synergy-muted">Select a project to view analysis results</p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-synergy-muted">Loading analysis...</p>;
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-synergy-muted">No results found for this analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-synergy-text">Territory Analysis</h1>
        <p className="text-synergy-muted mt-1">Ranked by net economic benefit</p>
      </div>

      <div className="bg-synergy-card rounded-lg border border-synergy-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-synergy-border">
            <thead className="bg-synergy-dark">
              <tr>
                {[
                  { label: 'Rank', align: 'left' },
                  { label: 'Territory', align: 'left' },
                  { label: 'Rebate %', align: 'right' },
                  { label: 'Qualified Spend', align: 'right' },
                  { label: 'Est. Rebate', align: 'right' },
                  { label: 'Logistics', align: 'right' },
                  { label: 'Net Benefit', align: 'right' },
                  { label: 'Confidence', align: 'right' },
                ].map(({ label, align }) => (
                  <th
                    key={label}
                    className={`px-6 py-3 text-xs font-medium text-synergy-muted uppercase tracking-wider text-${align}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-synergy-border">
              {results.map((result) => (
                <tr
                  key={result.id}
                  className={`hover:bg-white/5 transition-colors ${result.rank <= 3 ? 'bg-white/5' : ''}`}
                >
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        RANK_STYLE[result.rank] ?? 'bg-synergy-border text-synergy-muted'
                      }`}
                    >
                      {result.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-synergy-text">
                      {result.territory_name}
                    </div>
                    <div className="text-xs text-synergy-muted">{result.territory_country}</div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-synergy-text">
                    {result.territory_percentage}%
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-synergy-muted">
                    {fmt(result.qualified_spend_total, result.currency)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-synergy-green">
                    {fmt(result.estimated_rebate, result.currency)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-synergy-orange">
                    {fmt(result.logistics_premium, result.currency)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-synergy-text">
                    {fmt(result.net_benefit, result.currency)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-synergy-muted">
                    {Math.round(Number(result.confidence_score) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
