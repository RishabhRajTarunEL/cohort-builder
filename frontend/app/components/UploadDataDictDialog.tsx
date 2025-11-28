'use client';

import { useState } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Alert } from '@/app/components/ui';

interface UploadDataDictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  atlasId: string;
  atlasName: string;
}

export default function UploadDataDictDialog({
  isOpen,
  onClose,
  onUploadComplete,
  atlasId,
  atlasName,
}: UploadDataDictDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate it's a CSV file
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('atlas_id', atlasId);

      // Get CSRF token
      const csrfToken = getCookie('csrftoken');
      const headers: HeadersInit = {};
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/polly/upload-data-dict`, {
        method: 'POST',
        headers: headers,
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload file');
      }

      setUploadSuccess(true);
      
      // Wait a moment to show success message, then proceed
      setTimeout(() => {
        onUploadComplete();
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload data dictionary');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkip = () => {
    onUploadComplete();
    handleClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError(null);
    setUploadSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold text-primary">Upload Data Dictionary</h2>
            <p className="text-sm text-text-light mt-1">{atlasName}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-text-light hover:text-text transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Alert */}
          <Alert variant="info" dismissible={false}>
            <p className="text-sm">
              Upload a CSV file containing your data dictionary. This will help provide better context
              for cohort building. You can skip this step if you don't have a data dictionary.
            </p>
          </Alert>

          {/* File Upload Area */}
          <div>
            <label
              htmlFor="file-upload"
              className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                selectedFile
                  ? 'border-success bg-success/5'
                  : 'border-border bg-secondary hover:bg-gray-100'
              } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {selectedFile ? (
                  <>
                    <CheckCircle className="w-12 h-12 mb-3 text-success" />
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={20} className="text-success" />
                      <p className="text-sm font-semibold text-text">{selectedFile.name}</p>
                    </div>
                    <p className="text-xs text-text-light">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                    <p className="text-xs text-primary mt-2">Click to change file</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mb-3 text-text-light" />
                    <p className="mb-2 text-sm text-text">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-text-light">CSV files only</p>
                  </>
                )}
              </div>
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="error" dismissible={false}>
              {error}
            </Alert>
          )}

          {/* Success Message */}
          {uploadSuccess && (
            <Alert variant="success" dismissible={false}>
              <div className="flex items-center gap-2">
                <CheckCircle size={20} />
                <span>Data dictionary uploaded successfully!</span>
              </div>
            </Alert>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-secondary">
          <Button
            onClick={handleSkip}
            disabled={isUploading || uploadSuccess}
            variant="secondary"
          >
            Skip
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || uploadSuccess}
            variant="primary"
            isLoading={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload & Process'}
          </Button>
        </div>
      </div>
    </div>
  );
}
