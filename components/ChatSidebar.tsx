'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  workflowId: string | null;
  onTestWorkflow: (input: string) => Promise<string>;
}

export default function ChatSidebar({
  isOpen,
  onToggle,
  workflowId,
  onTestWorkflow
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Material You Design 3 colors - using CSS variables for theme support
  const colors = {
    primary: "var(--color-primary)",
    onPrimary: "var(--text-on-primary)",
    primaryContainer: "var(--color-primary-container)",
    onPrimaryContainer: "var(--color-on-primary-container)",
    secondary: "var(--color-secondary)",
    secondaryContainer: "var(--color-secondary-container)",
    onSecondaryContainer: "var(--color-on-secondary-container)",
    surface: "var(--color-surface)",
    onSurface: "var(--color-on-surface)",
    surfaceVariant: "var(--color-surface-variant)",
    onSurfaceVariant: "var(--color-on-surface-variant)",
    surfaceContainerLow: "var(--color-surface-container-low)",
    surfaceContainer: "var(--color-surface-container)",
    surfaceContainerHigh: "var(--color-surface-container-high)",
    outline: "var(--color-outline)",
    outlineVariant: "var(--color-outline-variant)",
    error: "var(--color-error)",
    errorContainer: "var(--color-error-container)",
    userMessageBg: "var(--color-secondary-container)",
    userMessageText: "var(--color-on-secondary-container)",
    assistantMessageBg: "var(--bg-card)",
    assistantMessageText: "var(--text-primary)",
  };

  const elevations = {
    level1: "0px 1px 2px 0px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)",
    level2: "0px 1px 2px 0px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)",
    level3: "0px 1px 3px 0px rgba(0,0,0,0.3), 0px 4px 8px 3px rgba(0,0,0,0.15)",
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !workflowId || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await onTestWorkflow(userMessage.content);

      // Update assistant message with response
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: response, isStreaming: false }
          : msg
      ));
    } catch (error) {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              isStreaming: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Toggle Button (FAB) */}
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          right: isOpen ? '376px' : '24px',
          bottom: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: colors.primaryContainer,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          boxShadow: elevations.level3,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1000,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colors.primary;
          e.currentTarget.style.color = colors.onPrimary;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = colors.primaryContainer;
          e.currentTarget.style.color = colors.onPrimaryContainer;
          e.currentTarget.style.transform = 'scale(1)';
        }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Sidebar */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100vh',
          width: '360px',
          background: colors.surfaceContainerLow,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? elevations.level3 : 'none',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          borderLeft: `1px solid ${colors.outlineVariant}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            background: colors.surfaceContainer,
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.outlineVariant}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>💬</span>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '500',
                color: colors.onSurface,
              }}
            >
              Test Chat
            </h2>
          </div>
          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            style={{
              padding: '8px 12px',
              background: colors.surfaceContainerHigh,
              border: `1px solid ${colors.outlineVariant}`,
              borderRadius: '12px',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              color: messages.length === 0 ? colors.outline : colors.onSurface,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (messages.length > 0) {
                e.currentTarget.style.background = colors.errorContainer;
                e.currentTarget.style.color = colors.error;
              }
            }}
            onMouseLeave={(e) => {
              if (messages.length > 0) {
                e.currentTarget.style.background = colors.surfaceContainerHigh;
                e.currentTarget.style.color = colors.onSurface;
              }
            }}
          >
            Clear
          </button>
        </div>

        {/* Messages Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                textAlign: 'center',
                color: colors.onSurfaceVariant,
              }}
            >
              <span style={{ fontSize: '48px' }}>💬</span>
              <div>
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: colors.onSurface,
                  }}
                >
                  Start a Conversation
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: colors.onSurfaceVariant,
                  }}
                >
                  Test your workflow by sending a message
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '12px 16px',
                      borderRadius: message.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      background: message.role === 'user' ? colors.userMessageBg : colors.assistantMessageBg,
                      color: message.role === 'user' ? colors.userMessageText : colors.assistantMessageText,
                      boxShadow: elevations.level1,
                      fontSize: '14px',
                      lineHeight: '20px',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {message.isStreaming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: colors.primary,
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                        <span style={{ color: colors.onSurfaceVariant }}>Thinking...</span>
                      </div>
                    ) : (
                      message.content
                    )}
                    <div
                      style={{
                        fontSize: '11px',
                        color: colors.outline,
                        marginTop: '4px',
                        textAlign: message.role === 'user' ? 'right' : 'left',
                      }}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div
          style={{
            padding: '16px 20px',
            background: colors.surfaceContainer,
            borderTop: `1px solid ${colors.outlineVariant}`,
          }}
        >
          {!workflowId && (
            <div
              style={{
                padding: '12px',
                marginBottom: '12px',
                background: colors.errorContainer,
                border: `1px solid ${colors.error}`,
                borderRadius: '12px',
                fontSize: '13px',
                color: colors.error,
                textAlign: 'center',
              }}
            >
              Please create or load a workflow first
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              disabled={!workflowId || isLoading}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: `1px solid ${colors.outline}`,
                borderRadius: '24px',
                fontSize: '14px',
                lineHeight: '20px',
                background: colors.surface,
                color: colors.onSurface,
                resize: 'none',
                minHeight: '48px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.outline;
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !workflowId || isLoading}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '24px',
                background: !inputValue.trim() || !workflowId || isLoading
                  ? colors.surfaceContainerHigh
                  : colors.primary,
                border: 'none',
                cursor: !inputValue.trim() || !workflowId || isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: colors.onPrimary,
                boxShadow: !inputValue.trim() || !workflowId || isLoading ? 'none' : elevations.level2,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (inputValue.trim() && workflowId && !isLoading) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.background = '#7D5AAF';
                }
              }}
              onMouseLeave={(e) => {
                if (inputValue.trim() && workflowId && !isLoading) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = colors.primary;
                }
              }}
            >
              {isLoading ? '⏳' : '▶'}
            </button>
          </div>
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: colors.outline,
              textAlign: 'center',
            }}
          >
            Press Enter to send • Shift + Enter for new line
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </>
  );
}
