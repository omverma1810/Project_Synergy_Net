import { Suspense } from 'react';
import AnalysisResults from './AnalysisResults';

export default function AnalysisPage() {
  return (
    <Suspense fallback={<p className="text-synergy-muted">Loading analysis...</p>}>
      <AnalysisResults />
    </Suspense>
  );
}
