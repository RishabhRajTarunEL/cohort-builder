import { useState } from 'react';
import { Database } from 'lucide-react';
import { Modal, Button, FormField } from '@/app/components/ui';

interface ConnectDBDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (dbName: string, apiKey: string) => void;
}

export default function ConnectDBDialog({ isOpen, onClose, onConnect }: ConnectDBDialogProps) {
  const [dbName, setDbName] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(dbName, apiKey);
    setDbName('');
    setApiKey('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center gap-2 mb-6">
        <Database className="text-primary" />
        <h2 className="text-xl font-bold text-primary">Connect Database</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Database Name" htmlFor="dbName" required>
          <input
            type="text"
            id="dbName"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            required
            className="form-control"
            placeholder="Enter database name"
          />
        </FormField>

        <FormField label="API Key" htmlFor="apiKey" required>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            className="form-control"
            placeholder="Enter API key"
          />
        </FormField>

        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="accent"
            className="flex-1"
          >
            Connect
          </Button>
        </div>
      </form>
    </Modal>
  );
}
