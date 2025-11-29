'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { User, Mail, Building, Briefcase, Save, Key, Eye, EyeOff } from 'lucide-react';
import { api } from '@/app/lib/api';
import { Button, Alert, Loading, FormField } from '@/app/components/ui';

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    polly_api_key: '',
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text="Loading profile..." />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const updateData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
      };

      // Only include polly_api_key if it was changed
      if (formData.polly_api_key) {
        updateData.polly_api_key = formData.polly_api_key;
      }

      console.log('Submitting profile update:', updateData);
      const response = await api.patch('/auth/profile', updateData);
      console.log('Profile update response:', response);
      
      await refreshUser();
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleEditClick = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      polly_api_key: '',
    });
    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {success && (
          <div className="mb-6">
            <Alert variant="success">{success}</Alert>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {/* Profile Card */}
        <div className="card">
          {/* Header Section */}
          <div className="h-32 bg-gradient-to-br from-primary to-primary-dark"></div>
          
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-16 mb-6">
              <div 
                className="flex items-center justify-center w-32 h-32 rounded-full text-white text-4xl font-bold border-4 border-white shadow-lg bg-primary"
              >
                {user.first_name?.[0]?.toUpperCase() || user.username[0].toUpperCase()}
              </div>
              
              {!isEditing && (
                <Button onClick={handleEditClick} variant="accent">
                  Edit Profile
                </Button>
              )}
            </div>

            {/* Profile Information */}
            {!isEditing ? (
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <h2 className="text-3xl font-bold text-primary">
                    {user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user.username}
                  </h2>
                  <p className="mt-1 text-text-light">@{user.username}</p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  {/* Email */}
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-info/20">
                      <Mail className="w-5 h-5 text-info" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-light">Email</p>
                      <p className="mt-1 text-text">{user.email}</p>
                    </div>
                  </div>

                  {/* Username */}
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-error/20">
                      <User className="w-5 h-5 text-error" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-light">Username</p>
                      <p className="mt-1 text-text">{user.username}</p>
                    </div>
                  </div>

                  {/* Account Status */}
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-success/20">
                      <Briefcase className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-light">Account Status</p>
                      <p className="mt-1">
                        {user.is_approved ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-success/20 text-success">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-warning/20 text-warning">
                            Pending Approval
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* User ID */}
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-light">User ID</p>
                      <p className="mt-1 text-text">{user.id}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="First Name" htmlFor="first_name">
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </FormField>

                  <FormField label="Last Name" htmlFor="last_name">
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </FormField>
                </div>

                {/* Polly API Key */}
                <div>
                  <label htmlFor="polly_api_key" className="block text-sm font-medium mb-2 text-text">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Polly API Key
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      id="polly_api_key"
                      name="polly_api_key"
                      value={formData.polly_api_key}
                      onChange={handleChange}
                      className="form-control pr-12"
                      placeholder="Enter new API key to update"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text"
                    >
                      {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-text-light">
                    Leave blank to keep your existing API key unchanged
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    variant="accent"
                    loading={isSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="card mt-8">
          <h3 className="text-lg font-semibold mb-4 text-primary">Account Information</h3>
          <div className="space-y-3 text-sm text-text-light">
            <p>
              <span className="font-medium">Profile Completion:</span>{' '}
              {user.has_completed_profile ? (
                <span className="text-success">Complete</span>
              ) : (
                <span className="text-warning">Incomplete</span>
              )}
            </p>
            <p>
              <span className="font-medium">Member since:</span> {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
