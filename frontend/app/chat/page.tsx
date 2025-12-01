'use client';

import { useState } from 'react';
import DatabaseExplorer from '../components/LeftPanel/DatabaseExplorer';
import FilterDropdownPanel from '../components/LeftPanel/FilterDropdownPanel';
import MiddlePanel from '../components/MiddlePanel/MiddlePanel';
import RightPanel from '../components/RightPanel/RightPanel';
import { FieldMappingProvider } from '../contexts/FieldMappingContext';

export default function ChatPage() {
  const [isSchemaCollapsed, setIsSchemaCollapsed] = useState(false);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  
  return (
    <FieldMappingProvider>
      <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Left Panel - 20% (Split into two sections) */}
      <div className="w-[20%] border-r border-border bg-white flex flex-col">
        {/* Filter Dropdowns - Collapsible */}
        <div 
          className={`overflow-hidden border-b border-border transition-all duration-300 ${
            isFilterCollapsed ? 'h-auto' : isSchemaCollapsed ? 'flex-1' : 'h-[50%]'
          }`}
        >
          <div className={`overflow-y-auto h-full transition-all duration-300`}>
            <FilterDropdownPanel 
              isCollapsed={isFilterCollapsed}
              onCollapseChange={setIsFilterCollapsed}
            />
          </div>
        </div>
        {/* Database Schema - Collapsible, expands when filters are collapsed */}
        <div 
          className={`overflow-hidden transition-all duration-300 ${
            isSchemaCollapsed ? 'h-auto' : isFilterCollapsed ? 'flex-1' : 'h-[50%]'
          }`}
        >
          <DatabaseExplorer 
            isCollapsed={isSchemaCollapsed}
            onCollapseChange={setIsSchemaCollapsed}
          />
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
