'use client';

import React, { useState } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { getCohort } from '@/app/lib/cohortStorage';

interface Message {
  role: 'user' | 'ai';
  content: string;
  plotData?: {
    type: string;
    plotType: string;
    title: string;
    data: Record<string, number>;
  };
}

interface AnalysisChatPanelProps {
  cohortId: string;
  onPlotGenerated?: (plotData: any) => void;
}

export default function AnalysisChatPanel({ cohortId, onPlotGenerated }: AnalysisChatPanelProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: "Hi! I'm your AI analysis assistant. Ask me questions about your cohort data, request custom visualizations, or explore statistical insights.\n\nTry asking:\n• Show me age distribution\n• What's the gender breakdown?\n• Show mutation frequency\n• Display diagnosis distribution",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    // Add user message
    const userMessage = message;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessage('');
    setIsLoading(true);

    try {
      // Get cohort data
      const cohort = getCohort(cohortId);

      if (!cohort) {
        setMessages(prev => [
          ...prev,
          {
            role: 'ai',
            content: "I couldn't find the cohort data. Please try refreshing the page.",
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Call AI backend
      const response = await fetch('http://localhost:5001/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage,
          cohortData: {
            cohortCount: cohort.cohortCount,
            filters: cohort.filters,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const aiResponse = await response.json();

      // Add AI response
      const aiMessage: Message = {
        role: 'ai',
        content: aiResponse.message,
      };

      // If response includes plot data, add it and notify parent
      if (aiResponse.type === 'plot') {
        aiMessage.plotData = {
          type: aiResponse.type,
          plotType: aiResponse.plotType,
          title: aiResponse.title,
          data: aiResponse.data,
        };

        // Notify parent component to render the plot
        if (onPlotGenerated) {
          onPlotGenerated(aiMessage.plotData);
        }
      }

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error calling AI backend:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content: "I'm having trouble connecting to the analysis service. Please make sure the Python backend is running on port 5001ss.\n\nTo start it, run:\ncd backend && pip install -r requirements.txt && python ai_agent.py",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4" style={{ borderColor: '#6B7280' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: '#06B6D4' }} />
          <h3 className="font-semibold" style={{ color: '#111827' }}>
            Explore with AI
          </h3>
        </div>
        <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
          Ask questions about your cohort
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#06B6D4] to-[#111827] text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-line">{msg.content}</p>
              {msg.plotData && (
                <div className="mt-2 text-xs opacity-75">
                  📊 Generated: {msg.plotData.title}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#06B6D4' }} />
                <span className="text-sm" style={{ color: '#111827' }}>
                  Analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4" style={{ borderColor: '#6B7280' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Ask about your cohort..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-[#06B6D4] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: '#6B7280', color: '#2d3748' }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className="px-4 py-2 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#06B6D4' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
