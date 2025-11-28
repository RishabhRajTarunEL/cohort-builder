'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Folder, MessageSquare, Calendar, Database, Loader2, AlertCircle } from 'lucide-react';
import api from '@/app/lib/api';
import { Button, Alert, Loading } from '@/app/components/ui';

interface CohortProject {
  id: number;
  name: string;
  atlas_id: string;
  atlas_name: string;
  description: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export default function CohortsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<CohortProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.get('/cohort-projects');
      setProjects(data);
    } catch (err: any) {
      console.error('Failed to fetch projects:', err);
      setError(err.message || 'Failed to load cohort projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectClick = (project: CohortProject) => {
    // Navigate to chat page with project ID
    router.push(`/chat/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-2 text-primary">
            Cohort Projects
          </h1>
          <p className="text-lg text-text-light">
            View and manage your cohort building projects
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="card p-16 text-center">
            <Loading size="lg" text="Loading Projects..." />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Alert variant="error" title="Failed to Load Projects">
            {error}
          </Alert>
        )}

        {/* Projects Grid */}
        {!isLoading && !error && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className="card hover:shadow-lg transition-all duration-300 cursor-pointer group"
              >
                {/* Icon */}
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-lg bg-primary-light flex items-center justify-center transition-transform group-hover:scale-110">
                    <Folder size={28} className="text-primary" strokeWidth={2} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-light">
                    <MessageSquare size={16} />
                    <span className="font-semibold">{project.message_count}</span>
                  </div>
                </div>

                {/* Project Name */}
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary-dark transition-colors text-primary">
                  {project.name}
                </h3>

                {/* Atlas Info */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                  <Database size={14} className="text-text-light" />
                  <span className="text-sm font-medium text-text-light">
                    {project.atlas_name}
                  </span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-text-light">
                  <Calendar size={14} />
                  <span>
                    Created {new Date(project.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && projects.length === 0 && (
          <div className="card p-16 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-primary-light">
              <Folder size={40} className="text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-primary">
              No Cohort Projects Yet
            </h3>
            <p className="text-base mb-8 max-w-md mx-auto text-text-light">
              Start building cohorts by processing an atlas from your dashboard.
            </p>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="accent"
              className="shadow-lg"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
