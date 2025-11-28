'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import DatabaseSchemaPanel from './components/DatabaseSchemaPanel';
import AnalysisChartsPanel from './components/AnalysisChartsPanel';
import AnalysisChatPanel from './components/AnalysisChatPanel';

export default function AnalyzePage() {
  const params = useParams();
  const cohortId = params.cohortId as string;
  const [generatedPlots, setGeneratedPlots] = useState<any[]>([]);

  const handlePlotGenerated = (plotData: any) => {
    setGeneratedPlots(prev => [...prev, plotData]);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Left Panel - 20% (AI Chat) */}
      <div className="w-[20%] border-r border-border bg-white">
        <AnalysisChatPanel cohortId={cohortId} onPlotGenerated={handlePlotGenerated} />
      </div>

      {/* Middle Panel - 60% (Charts and Plots) */}
      <div className="w-[60%] flex flex-col bg-white">
        <AnalysisChartsPanel cohortId={cohortId} generatedPlots={generatedPlots} />
      </div>

      {/* Right Panel - 20% (Database Schema & Filtered Table) */}
      <div className="w-[20%] border-l border-border bg-white overflow-y-auto">
        <DatabaseSchemaPanel cohortId={cohortId} />
      </div>
    </div>
  );
}
