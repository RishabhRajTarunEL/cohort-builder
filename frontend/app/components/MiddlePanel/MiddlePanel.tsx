'use client';

import React from 'react';
import ConversationalChat from './ConversationalChat';

interface MiddlePanelProps {
  projectId?: string;
}

export default function MiddlePanel({ projectId }: MiddlePanelProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Conversational Chat Interface - Full Height */}
      <div className="h-full flex flex-col">
        <ConversationalChat projectId={projectId} />
      </div>
    </div>
  );
}
