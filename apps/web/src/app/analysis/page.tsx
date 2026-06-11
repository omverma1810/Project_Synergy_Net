import { Suspense } from 'react';
import AnalysisResults from './AnalysisResults';
import Layout from '@/components/Layout';

export default function AnalysisPage() {
  return (
    <Layout>
      <Suspense fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-64 bg-synergy-card rounded-lg" />
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-synergy-card rounded-2xl" />)}
        </div>
      }>
        <AnalysisResults />
      </Suspense>
    </Layout>
  );
}
