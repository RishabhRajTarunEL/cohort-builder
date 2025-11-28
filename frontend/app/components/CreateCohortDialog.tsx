import React, { useState } from 'react';
import { Modal, Button, FormField } from '@/app/components/ui';

interface CreateCohortDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (projectName: string) => void;
  atlasName: string;
  atlasId: string;
}

export default function CreateCohortDialog({
  isOpen,
  onClose,
  onConfirm,
  atlasName,
  atlasId
}: CreateCohortDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(projectName.trim());
      setProjectName('');
      onClose();
    } catch (error) {
      console.error('Failed to create cohort project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setProjectName('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Start New Cohort" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Atlas Info */}
        <div className="section">
          <p className="text-xs font-semibold text-text-light uppercase tracking-wider mb-1">
            Atlas
          </p>
          <p className="text-sm font-medium text-text">
            {atlasName}
          </p>
          <p className="text-xs text-text-light mt-1">
            ID: {atlasId}
          </p>
        </div>

        {/* Project Name Input */}
        <FormField 
          label="Project Name" 
          htmlFor="projectName" 
          required
          helpText="Choose a descriptive name for your cohort project"
        >
          <input
            id="projectName"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., Cancer Patient Analysis"
            disabled={isSubmitting}
            className="form-control"
            autoFocus
            required
          />
        </FormField>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            variant="secondary"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !projectName.trim()}
            variant="accent"
            isLoading={isSubmitting}
            className="flex-1"
          >
            Start Cohort
          </Button>
        </div>
      </form>
    </Modal>
  );
}
