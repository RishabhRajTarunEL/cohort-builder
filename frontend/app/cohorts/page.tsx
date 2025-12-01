'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Folder, MessageSquare, Calendar, Database, Loader2, AlertCircle, Share2, User as UserIcon, X, Edit2, List, Grid } from 'lucide-react';
import api from '@/app/lib/api';
import { Button, Alert, Loading } from '@/app/components/ui';
import Tag from '@/app/components/ui/Tag';
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
  title: string;
  total_chats: number;
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
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [editProject, setEditProject] = useState<CohortProject | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.get('/cohort-projects');
      // Debug: Log total_chats to verify it's being returned
      console.log('Projects data:', data.map((p: any) => ({ id: p.id, name: p.name, total_chats: p.total_chats })));
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
    setSelectedUserId(null);
    
    // Fetch available users
    try {
      const users = await api.get('/users');
      setAvailableUsers(users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleAddUser = () => {
    if (!selectedUserId || typeof selectedUserId !== 'number') return;
    
    // Check if user is already in the list
    if (!selectedUserIds.includes(selectedUserId)) {
      setSelectedUserIds([...selectedUserIds, selectedUserId]);
      setSelectedUserId(null); // Reset dropdown
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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

  const sortedProjects = (() => {
    const projectsToSort = activeTab === 'my' ? myProjects : sharedProjects;
    return [...projectsToSort].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'owner':
          aValue = a.owner?.full_name || a.owner?.username || '';
          bValue = b.owner?.full_name || b.owner?.username || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'total_chats':
          aValue = a.total_chats || 0;
          bValue = b.total_chats || 0;
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  })();

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

        {/* Tabs and View Toggle */}
        <div className="mb-6 flex items-center justify-between border-b border-border">
          <div className="flex gap-2">
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
          
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Table View"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'card'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Card View"
            >
              <Grid size={20} />
            </button>
          </div>
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

        {/* Projects Display */}
        {!isLoading && !error && sortedProjects.length > 0 && (
          viewMode === 'table' ? (
            /* Table View */
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-text cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('owner')}
                    >
                      User {sortField === 'owner' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-text cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('created_at')}
                    >
                      Date {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-text cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-text cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('title')}
                    >
                      Title {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-text cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('total_chats')}
                    >
                      Total Chats {sortField === 'total_chats' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-semibold text-text cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('updated_at')}
                    >
                      Last Update {sortField === 'updated_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects.map((project) => (
                    <tr 
                      key={project.id} 
                      className="border-b border-border hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleProjectClick(project)}
                    >
                      <td className="px-4 py-3 text-sm text-text">
                        {project.owner?.full_name || project.owner?.username || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-light">
                        {new Date(project.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-primary">
                        {project.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-light max-w-xs">
                        {project.title ? (
                          <Tag variant="blue" style="light" size="sm">
                            {project.title}
                          </Tag>
                        ) : (
                          <span className="text-text-light">No queries yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text font-medium">
                        {project.total_chats ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-light">
                        {new Date(project.updated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {project.is_owner && (
                            <>
                              <button
                                onClick={(e) => handleEditClick(e, project)}
                                className="p-1 rounded hover:bg-gray-200 transition-colors"
                                title="Edit project"
                              >
                                <Edit2 size={16} className="text-text-light hover:text-primary" />
                              </button>
                              <button
                                onClick={(e) => handleShareClick(e, project)}
                                className="p-1 rounded hover:bg-gray-200 transition-colors"
                                title="Share project"
                              >
                                <Share2 size={16} className="text-text-light hover:text-primary" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedProjects.map((project) => (
              <div
                key={project.id}
                className="card hover:shadow-lg transition-all duration-300 group cursor-pointer"
                onClick={() => handleProjectClick(project)}
              >
                {/* Icon and Actions */}
                <div className="flex items-start justify-between">
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
                      <span className="font-semibold">{project.total_chats ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Title */}
                {project.title && (
                  <div className="mb-3 w-full overflow-hidden">
                    <div className="inline-block max-w-full">
                      <Tag variant="blue" style="light" size="sm">
                        {project.title}
                      </Tag>
                    </div>
                  </div>
                )}
                {/* Project Name */}
                <h3 
                  className="text-xl font-bold mb-2 group-hover:text-primary-dark transition-colors text-primary"
                >
                  {project.name}
                </h3>


                {/* Description */}
                {project.description && (
                  <p className="text-sm text-text-light mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* User/Owner */}
                <div className="flex items-center gap-2 mb-3 text-sm text-text-light">
                  <UserIcon size={14} />
                  <span>
                    {`${project.owner.full_name || project.owner.username}`}
                  </span>
                </div>

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
          )
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
              <div className="p-6 space-y-6">
                {/* Add User Section */}
                <div>
                  <p className="text-sm font-medium text-text mb-3">
                    Add users to share with:
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={selectedUserId || ''}
                      onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                      disabled={isSharing}
                      className="flex-1 form-control"
                    >
                      <option value="">Select a user...</option>
                      {availableUsers
                        .filter(user => !selectedUserIds.includes(user.id))
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name || user.username} ({user.email})
                          </option>
                        ))}
                    </select>
                    <Button
                      onClick={handleAddUser}
                      disabled={!selectedUserId || isSharing}
                      variant="accent"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Shared Users List */}
                <div>
                  <p className="text-sm font-medium text-text mb-3">
                    Users with access ({selectedUserIds.length}):
                  </p>
                  {selectedUserIds.length === 0 ? (
                    <p className="text-sm text-text-light text-center py-4 border border-border rounded-lg">
                      No users shared yet
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedUserIds.map((userId) => {
                        const user = availableUsers.find(u => u.id === userId);
                        if (!user) return null;
                        
                        return (
                          <div
                            key={userId}
                            className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-text">
                                  {user.full_name || user.username}
                                </p>
                                <p className="text-xs text-text-light truncate">{user.email}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
                              }}
                              disabled={isSharing}
                              className="text-danger hover:text-danger-dark text-sm font-medium px-2"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-secondary">
                <Button
                  onClick={() => {
                    setShareProject(null);
                    setSelectedUserIds([]);
                    setSelectedUserId(null);
                  }}
                  disabled={isSharing}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShare}
                  disabled={isSharing || selectedUserIds.length === 0}
                  variant="primary"
                  loading={isSharing}
                >
                  {isSharing ? 'Saving...' : 'Save Changes'}
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
