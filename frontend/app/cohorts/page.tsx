'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Folder, MessageSquare, Calendar, Database, Loader2, AlertCircle, Share2, User as UserIcon, X, Edit2 } from 'lucide-react';
import api from '@/app/lib/api';
import { Button, Alert, Loading } from '@/app/components/ui';
import EditProjectDialog from '@/app/components/EditProjectDialog';

interface SharedUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  initials: string;
}

interface Owner {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  initials: string;
}

interface CohortProject {
  id: number;
  name: string;
  atlas_id: string;
  atlas_name: string;
  description: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  shared_with: SharedUser[];
  owner: Owner;
  is_owner: boolean;
}

export default function CohortsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<CohortProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [shareProject, setShareProject] = useState<CohortProject | null>(null);
  const [availableUsers, setAvailableUsers] = useState<SharedUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [editProject, setEditProject] = useState<CohortProject | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleShareClick = async (e: React.MouseEvent, project: CohortProject) => {
    e.stopPropagation();
    setShareProject(project);
    setSelectedUserIds(project.shared_with.map(u => u.id));
    
    // Fetch available users
    try {
      const users = await api.get('/users');
      setAvailableUsers(users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleShare = async () => {
    if (!shareProject) return;
    
    setIsSharing(true);
    try {
      const response = await api.post(`/cohort-projects/${shareProject.id}/share`, {
        user_ids: selectedUserIds
      });
      
      // Update project in list
      setProjects(prev => prev.map(p => 
        p.id === shareProject.id ? response : p
      ));
      
      setShareProject(null);
      setSelectedUserIds([]);
    } catch (err: any) {
      console.error('Failed to share project:', err);
      alert(err.message || 'Failed to share project');
    } finally {
      setIsSharing(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent, project: CohortProject) => {
    e.stopPropagation();
    setEditProject(project);
  };

  const handleUpdateProject = async (name: string, description: string) => {
    if (!editProject) return;
    
    setIsUpdating(true);
    try {
      const updated = await api.patch(`/cohort-projects/${editProject.id}`, {
        name,
        description
      });
      
      // Update project in list
      setProjects(prev => prev.map(p => 
        p.id === editProject.id ? updated : p
      ));
      
      setEditProject(null);
    } catch (err: any) {
      console.error('Failed to update project:', err);
      alert(err.message || 'Failed to update project');
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnshare = async (userId: number) => {
    if (!shareProject) return;
    
    setIsSharing(true);
    try {
      // Use apiRequest directly for DELETE with body
      const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/cohort-projects/${shareProject.id}/share`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ user_ids: [userId] }),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to unshare');
      }
      
      const updatedProject = await response.json();
      
      // Update project in list
      setProjects(prev => prev.map(p => 
        p.id === shareProject.id ? updatedProject : p
      ));
      
      setShareProject(updatedProject);
      setSelectedUserIds(updatedProject.shared_with.map((u: SharedUser) => u.id));
    } catch (err: any) {
      console.error('Failed to unshare project:', err);
      alert(err.message || 'Failed to unshare project');
    } finally {
      setIsSharing(false);
    }
  };

  const myProjects = projects.filter(p => p.is_owner);
  const sharedProjects = projects.filter(p => !p.is_owner);

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

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'my'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-light hover:text-text'
            }`}
          >
            My Projects ({myProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'shared'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-light hover:text-text'
            }`}
          >
            Shared with Me ({sharedProjects.length})
          </button>
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
        {!isLoading && !error && (activeTab === 'my' ? myProjects : sharedProjects).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {(activeTab === 'my' ? myProjects : sharedProjects).map((project) => (
              <div
                key={project.id}
                className="card hover:shadow-lg transition-all duration-300 group"
              >
                {/* Icon and Actions */}
                <div className="flex items-start justify-between mb-5">
                  <div 
                    onClick={() => handleProjectClick(project)}
                    className="w-14 h-14 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 cursor-pointer"
                  >
                    <Folder size={28} className="text-primary" strokeWidth={2} />
                  </div>
                  <div className="flex items-center gap-2">
                    {project.is_owner && (
                      <>
                        <button
                          onClick={(e) => handleEditClick(e, project)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Edit project"
                        >
                          <Edit2 size={18} className="text-text-light hover:text-primary" />
                        </button>
                        <button
                          onClick={(e) => handleShareClick(e, project)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Share project"
                        >
                          <Share2 size={18} className="text-text-light hover:text-primary" />
                        </button>
                      </>
                    )}
                    <div className="flex items-center gap-2 text-sm text-text-light">
                      <MessageSquare size={16} />
                      <span className="font-semibold">{project.message_count}</span>
                    </div>
                  </div>
                </div>

                {/* Project Name */}
                <h3 
                  onClick={() => handleProjectClick(project)}
                  className="text-xl font-bold mb-2 group-hover:text-primary-dark transition-colors text-primary cursor-pointer"
                >
                  {project.name}
                </h3>

                {/* Description */}
                {project.description && (
                  <p className="text-sm text-text-light mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Owner (for shared projects) */}
                {!project.is_owner && project.owner && (
                  <div className="flex items-center gap-2 mb-3 text-sm text-text-light">
                    <UserIcon size={14} />
                    <span>Owner: {project.owner.full_name || project.owner.username}</span>
                  </div>
                )}

                {/* Shared Users Avatars */}
                {project.is_owner && project.shared_with.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-text-light">Shared with:</span>
                    <div className="flex -space-x-2">
                      {project.shared_with.slice(0, 5).map((sharedUser) => (
                        <div
                          key={sharedUser.id}
                          className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold border-2 border-white"
                          title={sharedUser.full_name || sharedUser.username}
                        >
                          {sharedUser.initials}
                        </div>
                      ))}
                      {project.shared_with.length > 5 && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-semibold border-2 border-white">
                          +{project.shared_with.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
        {!isLoading && !error && (activeTab === 'my' ? myProjects : sharedProjects).length === 0 && (
          <div className="card p-16 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Folder size={40} className="text-primary" strokeWidth={2} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-primary">
              {activeTab === 'my' ? 'No Cohort Projects Yet' : 'No Shared Projects'}
            </h3>
            <p className="text-base mb-8 max-w-md mx-auto text-text-light">
              {activeTab === 'my' 
                ? 'Start building cohorts by processing an atlas from your dashboard.'
                : 'Projects shared with you will appear here.'}
            </p>
            {activeTab === 'my' && (
              <Button
                onClick={() => router.push('/dashboard')}
                variant="accent"
                className="shadow-lg"
              >
                Go to Dashboard
              </Button>
            )}
          </div>
        )}

        {/* Share Dialog */}
        {shareProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h2 className="text-2xl font-bold text-primary">Share Project</h2>
                  <p className="text-sm text-text-light mt-1">{shareProject.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShareProject(null);
                    setSelectedUserIds([]);
                  }}
                  disabled={isSharing}
                  className="text-text-light hover:text-text transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-text-light mb-4">
                  Select users to share this project with:
                </p>

                {/* User List */}
                <div className="space-y-2">
                  {availableUsers.map((user) => {
                    const isSelected = selectedUserIds.includes(user.id);
                    const isCurrentlyShared = shareProject.shared_with.some(u => u.id === user.id);
                    
                    return (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-primary bg-opacity-10 border-primary'
                            : 'bg-white border-border hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                            }
                          }}
                          disabled={isSharing}
                          className="w-4 h-4 text-primary rounded"
                        />
                        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {user.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text">
                            {user.full_name || user.username}
                          </p>
                          <p className="text-xs text-text-light truncate">{user.email}</p>
                        </div>
                        {isCurrentlyShared && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnshare(user.id);
                            }}
                            disabled={isSharing}
                            className="text-danger hover:text-danger-dark text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>

                {availableUsers.length === 0 && (
                  <p className="text-sm text-text-light text-center py-4">
                    No other users available
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-secondary">
                <Button
                  onClick={() => {
                    setShareProject(null);
                    setSelectedUserIds([]);
                  }}
                  disabled={isSharing}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShare}
                  disabled={isSharing}
                  variant="primary"
                  loading={isSharing}
                >
                  {isSharing ? 'Sharing...' : 'Share'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Project Dialog */}
        {editProject && (
          <EditProjectDialog
            isOpen={!!editProject}
            onClose={() => setEditProject(null)}
            onConfirm={handleUpdateProject}
            projectName={editProject.name}
            projectDescription={editProject.description || ''}
          />
        )}
      </div>
    </div>
  );
}
