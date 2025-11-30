'use client';

import { useState } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, FileJson2 } from 'lucide-react';
import { Button, Alert } from '@/app/components/ui';

interface UploadDataDictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  atlasId: string;
  atlasName: string;
}

interface FileUploadState {
  file: File | null;
  uploading: boolean;
  success: boolean;
  error: string | null;
}

export default function UploadDataDictDialog({
  isOpen,
  onClose,
  onUploadComplete,
  atlasId,
  atlasName,
}: UploadDataDictDialogProps) {
  const [dataDictState, setDataDictState] = useState<FileUploadState>({
    file: null,
    uploading: false,
    success: false,
    error: null,
  });

  const [schemaKeysState, setSchemaKeysState] = useState<FileUploadState>({
    file: null,
    uploading: false,
    success: false,
    error: null,
  });

  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  };

  const handleDataDictSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setDataDictState(prev => ({ ...prev, error: 'Please select a CSV file' }));
        return;
      }
      setDataDictState(prev => ({ ...prev, file, error: null }));
    }
  };

  const handleSchemaKeysSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setSchemaKeysState(prev => ({ ...prev, error: 'Please select a JSON file' }));
        return;
      }
      setSchemaKeysState(prev => ({ ...prev, file, error: null }));
    }
  };

  const uploadFile = async (file: File, endpoint: string): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('atlas_id', atlasId);

    const csrfToken = getCookie('csrftoken');
    const headers: HeadersInit = {};
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to upload file');
    }

    return true;
  };

  const handleUploadAndProcess = async () => {
    setIsProcessing(true);

    try {
      // Upload data dictionary if selected
      if (dataDictState.file) {
        setDataDictState(prev => ({ ...prev, uploading: true, error: null }));
        try {
          await uploadFile(dataDictState.file, '/polly/upload-data-dict');
          setDataDictState(prev => ({ ...prev, uploading: false, success: true }));
        } catch (err: any) {
          setDataDictState(prev => ({ ...prev, uploading: false, error: err.message }));
          setIsProcessing(false);
          return;
        }
      }

      // Upload schema keys if selected
      if (schemaKeysState.file) {
        setSchemaKeysState(prev => ({ ...prev, uploading: true, error: null }));
        try {
          await uploadFile(schemaKeysState.file, '/polly/upload-schema-keys');
          setSchemaKeysState(prev => ({ ...prev, uploading: false, success: true }));
        } catch (err: any) {
          setSchemaKeysState(prev => ({ ...prev, uploading: false, error: err.message }));
          setIsProcessing(false);
          return;
        }
      }

      // All uploads successful, proceed with processing
      setTimeout(() => {
        onUploadComplete();
        handleClose();
      }, 1000);
    } catch (err) {
      console.error('Upload error:', err);
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    onUploadComplete();
    handleClose();
  };

  const handleClose = () => {
    setDataDictState({ file: null, uploading: false, success: false, error: null });
    setSchemaKeysState({ file: null, uploading: false, success: false, error: null });
    setIsProcessing(false);
    onClose();
  };

  const anyUploading = dataDictState.uploading || schemaKeysState.uploading;
  const allSuccess = (dataDictState.file ? dataDictState.success : true) && 
                     (schemaKeysState.file ? schemaKeysState.success : true) &&
                     (dataDictState.file || schemaKeysState.file);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold text-primary">Upload Configuration Files</h2>
            <p className="text-sm text-text-light mt-1">{atlasName}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={anyUploading}
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
              Upload optional configuration files to improve cohort building accuracy. 
              Both files are optional - you can skip if you don't have them.
            </p>
          </Alert>

          {/* Data Dictionary Upload */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              <h3 className="font-semibold text-text">Data Dictionary (CSV)</h3>
              <span className="text-xs text-text-light bg-secondary px-2 py-0.5 rounded">Optional</span>
            </div>
            <p className="text-sm text-text-light">
              Provides field descriptions and context for better natural language understanding.
            </p>
            <label
              htmlFor="data-dict-upload"
              className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                dataDictState.file
                  ? 'border-success bg-success/5'
                  : 'border-border bg-secondary hover:bg-gray-100'
              } ${anyUploading ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="flex flex-col items-center justify-center py-4">
                {dataDictState.file ? (
                  <>
                    <CheckCircle className="w-8 h-8 mb-2 text-success" />
                    <p className="text-sm font-semibold text-text">{dataDictState.file.name}</p>
                    <p className="text-xs text-text-light">
                      {(dataDictState.file.size / 1024).toFixed(2)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-text-light" />
                    <p className="text-sm text-text">Click to upload CSV</p>
                  </>
                )}
              </div>
              <input
                id="data-dict-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleDataDictSelect}
                disabled={anyUploading}
              />
            </label>
            {dataDictState.error && (
              <p className="text-sm text-danger flex items-center gap-1">
                <AlertCircle size={14} /> {dataDictState.error}
              </p>
            )}
            {dataDictState.success && (
              <p className="text-sm text-success flex items-center gap-1">
                <CheckCircle size={14} /> Uploaded successfully
              </p>
            )}
          </div>

          {/* Schema Keys Upload */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileJson2 size={20} className="text-primary" />
              <h3 className="font-semibold text-text">Schema Keys (JSON)</h3>
              <span className="text-xs text-text-light bg-secondary px-2 py-0.5 rounded">Optional</span>
            </div>
            <p className="text-sm text-text-light">
              Defines primary keys and foreign key relationships between tables for accurate SQL generation.
            </p>
            <label
              htmlFor="schema-keys-upload"
              className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                schemaKeysState.file
                  ? 'border-success bg-success/5'
                  : 'border-border bg-secondary hover:bg-gray-100'
              } ${anyUploading ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="flex flex-col items-center justify-center py-4">
                {schemaKeysState.file ? (
                  <>
                    <CheckCircle className="w-8 h-8 mb-2 text-success" />
                    <p className="text-sm font-semibold text-text">{schemaKeysState.file.name}</p>
                    <p className="text-xs text-text-light">
                      {(schemaKeysState.file.size / 1024).toFixed(2)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-text-light" />
                    <p className="text-sm text-text">Click to upload JSON</p>
                  </>
                )}
              </div>
              <input
                id="schema-keys-upload"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleSchemaKeysSelect}
                disabled={anyUploading}
              />
            </label>
            {schemaKeysState.error && (
              <p className="text-sm text-danger flex items-center gap-1">
                <AlertCircle size={14} /> {schemaKeysState.error}
              </p>
            )}
            {schemaKeysState.success && (
              <p className="text-sm text-success flex items-center gap-1">
                <CheckCircle size={14} /> Uploaded successfully
              </p>
            )}
            
            {/* Schema Keys Format Help */}
            <details className="text-xs text-text-light">
              <summary className="cursor-pointer hover:text-text">View expected format</summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded overflow-x-auto">
{`{
  "table_name": {
    "pk": "primary_key_column",
    "fks": {
      "foreign_key_column": "referenced_table"
    }
  }
}`}
              </pre>
            </details>
          </div>

          {/* All Success Message */}
          {allSuccess && (
            <Alert variant="success" dismissible={false}>
              <div className="flex items-center gap-2">
                <CheckCircle size={20} />
                <span>Files uploaded successfully! Processing will begin shortly...</span>
              </div>
            </Alert>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-secondary sticky bottom-0">
          <Button
            onClick={handleSkip}
            disabled={anyUploading || isProcessing}
            variant="secondary"
          >
            Skip & Process
          </Button>
          <Button
            onClick={handleUploadAndProcess}
            disabled={!!((dataDictState.file === null || schemaKeysState.file === null) || anyUploading || allSuccess)}
            variant="primary"
            loading={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Upload & Process'}
          </Button>
        </div>
      </div>
    </div>
  );
}
