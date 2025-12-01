'use client';

import { use, useState, useEffect } from 'react';
import DatabaseExplorer from '../../components/LeftPanel/DatabaseExplorer';
import FilterDropdownPanel from '../../components/LeftPanel/FilterDropdownPanel';
import MiddlePanel from '../../components/MiddlePanel/MiddlePanel';
import RightPanel from '../../components/RightPanel/RightPanel';
import { FieldMappingProvider } from '../../contexts/FieldMappingContext';
import { Loader2, Database } from 'lucide-react';

interface ChatPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { projectId } = use(params);
  const [isSchemaCollapsed, setIsSchemaCollapsed] = useState(false);
  const projectIdNum = parseInt(projectId, 10);
  
  const [isCacheReady, setIsCacheReady] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [checkingCache, setCheckingCache] = useState(true);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let isActive = true;

    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
      }
      return null;
    };

    const triggerCaching = async () => {
      setCheckingCache(true);
      setCacheError(null);
      
      try {
        // First, check if already cached (lightweight GET)
        const checkResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/cohort-projects/${projectIdNum}/cache-status`,
          { credentials: 'include' }
        );
        
        if (!isActive) return;

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.is_ready) {
            // Already cached!
            setIsCacheReady(true);
            setCheckingCache(false);
            return;
          }
        }

        // Not cached - trigger full caching with POST
        console.log('Triggering cache for atlas files...');
        const csrfToken = getCookie('csrftoken');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (csrfToken) {
          headers['X-CSRFToken'] = csrfToken;
        }

        const cacheResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/cohort-projects/${projectIdNum}/cache-status`,
          { 
            method: 'POST',
            credentials: 'include',
            headers
          }
        );
        
        if (!isActive) return;

        if (cacheResponse.ok) {
          const cacheData = await cacheResponse.json();
          if (cacheData.cached) {
            setIsCacheReady(true);
            setCheckingCache(false);
            console.log('Cache ready:', cacheData.files);
          } else {
            setCacheError(cacheData.error || 'Failed to cache files');
            setCheckingCache(false);
          }
        } else {
          // If POST fails, fall back to polling
          console.log('Cache trigger failed, falling back to polling...');
          setCheckingCache(false);
          startPolling();
        }
      } catch (error) {
        if (!isActive) return;
        console.error('Cache trigger failed:', error);
        setCacheError('Failed to connect to server.');
        setCheckingCache(false);
      }
    };

    const startPolling = () => {
      // Poll every 5 seconds (less aggressive)
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/cohort-projects/${projectIdNum}/cache-status`,
            { credentials: 'include' }
          );
          
          if (!isActive) return;

          if (response.ok) {
            const data = await response.json();
            if (data.is_ready) {
              setIsCacheReady(true);
              // Stop polling
              if (pollInterval) clearInterval(pollInterval);
              if (timeoutId) clearTimeout(timeoutId);
            }
          }
        } catch (error) {
          if (!isActive) return;
          console.error('Poll failed:', error);
        }
      }, 5000); // Poll every 5 seconds instead of 3

      // Stop polling after 2 minutes
      timeoutId = setTimeout(() => {
        if (pollInterval) clearInterval(pollInterval);
        if (isActive && !isCacheReady) {
          setCacheError('Cache loading timeout. Please refresh the page.');
        }
      }, 120000);
    };

    triggerCaching();

    // Cleanup on unmount or projectId change
    return () => {
      isActive = false;
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [projectIdNum]);

  const getCsrfToken = (): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; csrftoken=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  };

  const checkCacheStatus = async () => {
    // Retry button - triggers caching with POST
    setCheckingCache(true);
    setIsCacheReady(false);
    setCacheError(null);
    
    try {
      const csrfToken = getCsrfToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      // Trigger caching with POST
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/cohort-projects/${projectIdNum}/cache-status`,
        { 
          method: 'POST',
          credentials: 'include',
          headers
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.cached) {
          setIsCacheReady(true);
        } else {
          setCacheError(data.error || 'Failed to cache files. Please try again.');
        }
      } else {
        setCacheError('Failed to trigger caching. Please try again.');
      }
    } catch (error) {
      console.error('Cache check failed:', error);
      setCacheError('Failed to connect to server.');
    } finally {
      setCheckingCache(false);
    }
  };

  // Show full-page loader while cache is being prepared
  if (checkingCache || !isCacheReady) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] w-screen bg-white">
        <div className="text-center px-6 max-w-md">
          {cacheError ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <Database className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-red-500 mb-2">
                Failed to Load Atlas
              </h2>
              <p className="text-gray-600 mb-6">{cacheError}</p>
              <button
                onClick={checkCacheStatus}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-purple-500 mb-2">
                Loading Atlas Data
              </h2>
              <p className="text-gray-600 mb-2">
                Preparing your cohort builder workspace...
              </p>
              <p className="text-sm text-gray-500">
                This may take a minute if files are being downloaded from GCS
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <FieldMappingProvider projectId={projectIdNum}>
      <div className="flex h-full w-full overflow-hidden bg-white">
        {/* Left Panel - 20% (Split into two sections) */}
        <div className="w-[20%] border-r border-gray-200 bg-white flex flex-col">
          {/* Filter Dropdowns - Collapsible */}
          <div 
            className={`overflow-hidden border-b border-gray-200 transition-all duration-300 ${
              isFilterCollapsed ? 'h-auto' : isSchemaCollapsed ? 'flex-1' : 'h-[50%]'
            }`}
          >
            <div className={`overflow-y-auto h-full transition-all duration-300`}>
              <FilterDropdownPanel 
                projectId={projectIdNum}
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
              projectId={projectId} 
              isCollapsed={isSchemaCollapsed}
              onCollapseChange={setIsSchemaCollapsed}
            />
          </div>
        </div>

        {/* Middle Panel - 60% */}
        <div className="w-[60%] flex flex-col">
          <MiddlePanel projectId={projectId} />
        </div>

        {/* Right Panel - 20% */}
        <div className="w-[20%] border-l border-gray-200 bg-white overflow-y-auto">
          <RightPanel projectId={projectId} />
        </div>
      </div>
    </FieldMappingProvider>
  );
}
