'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Database, Users, Activity, Plus, ArrowRight, Clock, AlertCircle, FileText, HardDrive, User, Download, Loader2 } from 'lucide-react';
import ConnectDBDialog from '@/app/components/ConnectDBDialog';
import CreateCohortDialog from '@/app/components/CreateCohortDialog';
import UploadDataDictDialog from '@/app/components/UploadDataDictDialog';
import { useRouter } from 'next/navigation';
import { getAllAtlases, Atlas, processAtlas, getTaskStatus, getAtlasTaskStatus } from '@/app/lib/pollyService';
import api from '@/app/lib/api';
import { Button, Alert } from '@/app/components/ui';

interface DatabaseConnection {
  id: string;
  name: string;
  apiKey: string;
  connectedAt: string;
  status: 'active' | 'inactive';
}

interface TaskStatus {
  taskId: string;
  status: string;
  progress: number;
  error?: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCohortDialogOpen, setIsCohortDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedAtlas, setSelectedAtlas] = useState<Atlas | null>(null);
  const [atlasToProcess, setAtlasToProcess] = useState<string | null>(null);
  const [atlases, setAtlases] = useState<Atlas[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingTasks, setProcessingTasks] = useState<{ [key: string]: TaskStatus }>({});

  // Fetch atlases on component mount
  useEffect(() => {
    fetchAtlases();
  }, []);

  const fetchAtlases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const atlasData = await getAllAtlases();
      setAtlases(atlasData);
      
      // Check for running tasks for each atlas
      for (const atlas of atlasData) {
        checkAtlasTask(atlas.atlas_id);
      }
    } catch (err: any) {
      console.error('Failed to fetch atlases:', err);
      setError(err.message || 'Failed to load atlases');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAtlasTask = async (atlasId: string) => {
    try {
      const taskStatus = await getAtlasTaskStatus(atlasId);
      
      if (taskStatus.has_running_task) {
        setProcessingTasks(prev => ({
          ...prev,
          [atlasId]: {
            taskId: taskStatus.task_id,
            status: taskStatus.status || taskStatus.state,
            progress: taskStatus.progress || 0
          }
        }));
        
        // Start polling for this task
        pollTaskStatus(atlasId, taskStatus.task_id);
      }
    } catch (err) {
      console.error(`Failed to check task for atlas ${atlasId}:`, err);
    }
  };

  const stats = [
    {
      name: 'Total Atlases',
      value: atlases.length.toString(),
      icon: Database,
      bgColor: 'bg-info',
    },
    {
      name: 'Active Cohorts',
      value: '12',
      icon: Users,
      bgColor: 'bg-error',
    },
    {
      name: 'Recent Queries',
      value: '48',
      icon: Activity,
      bgColor: 'bg-warning',
    },
  ];

  const handleConnectDB = (dbName: string, apiKey: string) => {
    setIsDialogOpen(false);
  };

  const handleStartCohort = (atlasId: string) => {
    const atlas = atlases.find(a => a.atlas_id === atlasId);
    if (atlas) {
      setSelectedAtlas(atlas);
      setIsCohortDialogOpen(true);
    }
  };

  const createCohortProject = async (projectName: string) => {
    if (!selectedAtlas) return;

    try {
      const project = await api.post('/cohort-projects', {
        name: projectName,
        atlas_id: selectedAtlas.atlas_id,
        atlas_name: selectedAtlas.atlas_name
      });
      
      router.push(`/chat/${project.id}`);
    } catch (err: any) {
      console.error('Failed to create cohort project:', err);
      alert(err.message || 'Failed to create cohort project');
      throw err;
    }
  };

  const handleProcessAtlasClick = (atlasId: string) => {
    // Open upload dialog first
    setAtlasToProcess(atlasId);
    setIsUploadDialogOpen(true);
  };

  const handleUploadComplete = async () => {
    // After upload (or skip), proceed with processing
    if (!atlasToProcess) return;
    
    try {
      const response = await processAtlas(atlasToProcess);
      const taskId = response.task_id;
      
      setProcessingTasks(prev => ({
        ...prev,
        [atlasToProcess]: { taskId, status: 'Processing...', progress: 0 }
      }));
      
      pollTaskStatus(atlasToProcess, taskId);
    } catch (err: any) {
      console.error('Failed to process atlas:', err);
      setProcessingTasks(prev => ({
        ...prev,
        [atlasToProcess]: { taskId: '', status: 'Failed', progress: 0 }
      }));
    } finally {
      setAtlasToProcess(null);
    }
  };

  const pollTaskStatus = async (atlasId: string, taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await getTaskStatus(taskId);
        
        setProcessingTasks(prev => ({
          ...prev,
          [atlasId]: {
            taskId,
            status: status.state === 'FAILURE' ? 'Failed' : (status.status || status.state),
            progress: status.progress || 0,
            error: status.state === 'FAILURE' ? (status.error || 'Task failed') : undefined
          }
        }));

        if (status.state === 'SUCCESS' || status.state === 'FAILURE') {
          clearInterval(interval);
          
          if (status.state === 'SUCCESS') {
            setTimeout(() => {
              setProcessingTasks(prev => {
                const updated = { ...prev };
                delete updated[atlasId];
                return updated;
              });
            }, 5000);
          }
        }
      } catch (err) {
        console.error('Failed to poll task status:', err);
        clearInterval(interval);
        setProcessingTasks(prev => ({
          ...prev,
          [atlasId]: {
            taskId,
            status: 'Failed',
            progress: 0
          }
        }));
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-2 text-primary">
            Welcome back, {user?.first_name || user?.username}!
          </h1>
          <p className="text-lg text-text-light">
            Manage your atlases, track cohorts, and get quick insights into your data.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-3 text-text-light">
                    {stat.name}
                  </p>
                  <p className="text-4xl font-bold text-text">
                    {stat.value}
                  </p>
                </div>
                <div className={`w-14 h-14 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <stat.icon size={28} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Atlases Section */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary">
              Your Polly Atlases
            </h2>
            <p className="text-sm mt-1 text-text-light">
              {isLoading ? 'Loading...' : `${atlases.length} ${atlases.length === 1 ? 'atlas' : 'atlases'} available`}
            </p>
          </div>
          <Button
            onClick={fetchAtlases}
            disabled={isLoading}
            variant="accent"
            isLoading={isLoading}
            className="shadow-lg"
          >
            <Activity size={20} strokeWidth={2.5} className="mr-2" />
            Refresh
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6">
            <Alert variant="error" title="Failed to Load Atlases">
              <p>{error}</p>
              <p className="text-sm mt-2">
                Make sure you have configured your Polly API key in your profile settings.
              </p>
            </Alert>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="card p-16 text-center">
            <Activity size={48} className="mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-xl font-bold mb-2 text-primary">
              Loading Atlases...
            </h3>
            <p className="text-base text-text-light">
              Fetching your atlases from Polly
            </p>
          </div>
        )}

        {/* Atlas Cards */}
        {!isLoading && !error && atlases.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {atlases.map((atlas, index) => (
              <div
                key={atlas.atlas_id || `atlas-${index}`}
                className="card hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-lg bg-primary-light flex items-center justify-center transition-transform group-hover:scale-110">
                    <Database size={28} className="text-primary" strokeWidth={2} />
                  </div>
                  <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-success text-white">
                    Available
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-2 text-primary">
                  {atlas.atlas_name}
                </h3>
                
                {atlas.description && (
                  <p className="text-sm mb-4 line-clamp-2 text-text-light">
                    {atlas.description}
                  </p>
                )}

                <div className="space-y-3 mb-5 pb-5 border-b border-border">
                  {atlas.num_tables !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1.5 text-text-light">
                        <FileText size={14} />
                        Tables
                      </span>
                      <span className="text-sm font-semibold text-text">
                        {atlas.num_tables}
                      </span>
                    </div>
                  )}
                  {atlas.size !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1.5 text-text-light">
                        <HardDrive size={14} />
                        Size
                      </span>
                      <span className="text-sm font-semibold text-text">
                        {(atlas.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  )}
                  {atlas.created_by && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1.5 text-text-light">
                        <User size={14} />
                        Created By
                      </span>
                      <span className="text-sm text-text">
                        {atlas.created_by.first_name} {atlas.created_by.last_name}
                      </span>
                    </div>
                  )}
                  {atlas.created_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1.5 text-text-light">
                        <Clock size={14} />
                        Created
                      </span>
                      <span className="text-sm text-text">
                        {new Date(atlas.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={() => handleProcessAtlasClick(atlas.atlas_id)}
                    disabled={
                      !atlas.num_tables || 
                      atlas.num_tables === 0 || 
                      (processingTasks[atlas.atlas_id] && processingTasks[atlas.atlas_id].status !== 'Failed')
                    }
                    variant={processingTasks[atlas.atlas_id]?.status === 'Failed' ? 'danger' : 'accent'}
                    className="w-full"
                    isLoading={processingTasks[atlas.atlas_id] && processingTasks[atlas.atlas_id].status !== 'Failed'}
                  >
                    {processingTasks[atlas.atlas_id] ? (
                      processingTasks[atlas.atlas_id].status === 'Failed' ? (
                        <>
                          <AlertCircle size={16} strokeWidth={2.5} className="mr-2" />
                          Retry Processing
                        </>
                      ) : (
                        `${processingTasks[atlas.atlas_id].status} (${processingTasks[atlas.atlas_id].progress}%)`
                      )
                    ) : !atlas.num_tables || atlas.num_tables === 0 ? (
                      <>
                        <AlertCircle size={16} strokeWidth={2.5} className="mr-2" />
                        No Tables Available
                      </>
                    ) : (
                      <>
                        <Download size={16} strokeWidth={2.5} className="mr-2" />
                        Process DB
                      </>
                    )}
                  </Button>

                  {processingTasks[atlas.atlas_id]?.status === 'Failed' && processingTasks[atlas.atlas_id]?.error && (
                    <Alert variant="error" dismissible={false} className="text-xs">
                      {processingTasks[atlas.atlas_id].error}
                    </Alert>
                  )}

                  <Button
                    onClick={() => handleStartCohort(atlas.atlas_id)}
                    variant="primary"
                    className="w-full"
                  >
                    Start Cohort
                    <ArrowRight size={16} strokeWidth={2.5} className="ml-2" />
                  </Button>
                  <Button
                    onClick={() => router.push('/cohorts')}
                    variant="secondary"
                    className="w-full"
                  >
                    View Cohorts
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && atlases.length === 0 && (
          <div className="card p-16 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-primary-light">
              <Database size={40} className="text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-primary">
              No atlases found
            </h3>
            <p className="text-base mb-8 max-w-md mx-auto text-text-light">
              You don't have any atlases available. Make sure your Polly API key is configured correctly in your profile.
            </p>
            <Button
              onClick={() => router.push('/profile')}
              variant="accent"
              className="shadow-lg"
            >
              Update Profile
            </Button>
          </div>
        )}
      </div>

      <ConnectDBDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConnect={handleConnectDB}
      />

      <CreateCohortDialog
        isOpen={isCohortDialogOpen}
        onClose={() => setIsCohortDialogOpen(false)}
        onConfirm={createCohortProject}
        atlasName={selectedAtlas?.atlas_name || ''}
        atlasId={selectedAtlas?.atlas_id || ''}
      />
      <UploadDataDictDialog
        isOpen={isUploadDialogOpen}
        onClose={() => {
          setIsUploadDialogOpen(false);
          setAtlasToProcess(null);
        }}
        onUploadComplete={handleUploadComplete}
        atlasId={atlasToProcess || ''}
        atlasName={atlases.find(a => a.atlas_id === atlasToProcess)?.atlas_name || ''}
      />
    </div>
  );
}
