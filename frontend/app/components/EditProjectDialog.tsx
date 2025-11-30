import React, { useState, useEffect } from 'react';
import { Modal, Button, FormField } from '@/app/components/ui';

interface EditProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string) => Promise<void>;
  projectName: string;
  projectDescription: string;
}

export default function EditProjectDialog({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  projectDescription
}: EditProjectDialogProps) {
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(projectDescription);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when project data changes
  useEffect(() => {
    setName(projectName);
    setDescription(projectDescription);
  }, [projectName, projectDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(name.trim(), description.trim());
      onClose();
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName(projectName);
      setDescription(projectDescription);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Project" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5">
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cancer Patient Analysis"
            disabled={isSubmitting}
            className="form-control"
            autoFocus
            required
          />
        </FormField>

        {/* Description Input */}
        <FormField 
          label="Description" 
          htmlFor="description" 
          helpText="Optional: Add a description for your cohort project"
        >
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Analysis of cancer patients with specific criteria..."
            disabled={isSubmitting}
            className="form-control"
            rows={3}
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
            disabled={isSubmitting || !name.trim()}
            variant="accent"
            loading={isSubmitting}
            className="flex-1"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

