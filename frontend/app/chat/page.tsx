'use client';

import DatabaseExplorer from '../components/LeftPanel/DatabaseExplorer';
import FilterDropdownPanel from '../components/LeftPanel/FilterDropdownPanel';
import MiddlePanel from '../components/MiddlePanel/MiddlePanel';
import RightPanel from '../components/RightPanel/RightPanel';
import { FieldMappingProvider } from '../contexts/FieldMappingContext';

export default function ChatPage() {
  return (
    <FieldMappingProvider>
      <div className="flex h-[calc(100vh-4rem)] w-screen overflow-hidden bg-white">
      {/* Left Panel - 20% (Split into two sections) */}
      <div className="w-[20%] border-r border-border bg-white flex flex-col">
        {/* Database Schema - Top 50% */}
        <div className="h-[50%] overflow-y-auto border-b border-border">
          <DatabaseExplorer />
        </div>
        {/* Filter Dropdowns - Bottom 50% */}
        <div className="h-[50%] overflow-y-auto">
          <FilterDropdownPanel />
        </div>
      </div>

      {/* Middle Panel - 60% */}
      <div className="w-[60%] flex flex-col">
        <MiddlePanel />
      </div>

      {/* Right Panel - 20% */}
      <div className="w-[20%] border-l border-border bg-white overflow-y-auto">
        <RightPanel />
      </div>
    </div>
    </FieldMappingProvider>
  );
}
