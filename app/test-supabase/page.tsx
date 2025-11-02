'use client';

import { useState } from 'react';
import { testConnection, quickTest } from '@/lib/supabase/test-connection';

export default function TestSupabasePage() {
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    const icon = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warn: '⚠️'
    }[type];
    
    setTestOutput(prev => [...prev, `${icon} ${message}`]);
  };

  const runFullTest = async () => {
    setIsRunning(true);
    setTestOutput([]);
    
    // Intercept console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      addLog(args.join(' '), 'info');
      originalLog(...args);
    };
    
    console.error = (...args) => {
      addLog(args.join(' '), 'error');
      originalError(...args);
    };
    
    console.warn = (...args) => {
      addLog(args.join(' '), 'warn');
      originalWarn(...args);
    };

    try {
      await testConnection();
      addLog('Test completed!', 'success');
    } catch (error) {
      addLog(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }

    // Restore console
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    
    setIsRunning(false);
  };

  const runQuickTest = async () => {
    setIsRunning(true);
    setTestOutput([]);
    
    addLog('Running quick connection test...', 'info');
    
    try {
      const result = await quickTest();
      if (result) {
        addLog('Quick test passed!', 'success');
      } else {
        addLog('Quick test failed - check console for details', 'error');
      }
    } catch (error) {
      addLog(`Quick test error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setIsRunning(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '700',
            color: '#1a202c',
            marginBottom: '12px'
          }}>
            🧪 Supabase Connection Test
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#718096',
            marginBottom: '20px'
          }}>
            Test your Supabase configuration and connection
          </p>
        </div>

        {/* Test Buttons */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '30px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={runQuickTest}
            disabled={isRunning}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '16px 24px',
              background: isRunning ? '#cbd5e0' : '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (!isRunning) e.currentTarget.style.background = '#38a169';
            }}
            onMouseLeave={(e) => {
              if (!isRunning) e.currentTarget.style.background = '#48bb78';
            }}
          >
            {isRunning ? '⏳ Running...' : '⚡ Quick Test'}
          </button>

          <button
            onClick={runFullTest}
            disabled={isRunning}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '16px 24px',
              background: isRunning ? '#cbd5e0' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (!isRunning) e.currentTarget.style.background = '#5a67d8';
            }}
            onMouseLeave={(e) => {
              if (!isRunning) e.currentTarget.style.background = '#667eea';
            }}
          >
            {isRunning ? '⏳ Running...' : '🔍 Full Test'}
          </button>

          <button
            onClick={() => setTestOutput([])}
            disabled={isRunning}
            style={{
              padding: '16px 24px',
              background: isRunning ? '#cbd5e0' : '#ed8936',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (!isRunning) e.currentTarget.style.background = '#dd6b20';
            }}
            onMouseLeave={(e) => {
              if (!isRunning) e.currentTarget.style.background = '#ed8936';
            }}
          >
            🗑️ Clear
          </button>
        </div>

        {/* Info Box */}
        <div style={{
          background: '#ebf8ff',
          border: '2px solid #4299e1',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#2c5282',
            marginBottom: '12px'
          }}>
            ℹ️ What to expect:
          </h3>
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            color: '#2d3748',
            lineHeight: '1.8'
          }}>
            <li>✅ <strong>Client initialized</strong> - Supabase connected</li>
            <li>⚠️ <strong>No active session</strong> - Normal before Phase 4 (auth)</li>
            <li>⚠️ <strong>RLS blocking access</strong> - This is GOOD! Security working</li>
            <li>💡 Authentication will be added in Phase 4</li>
          </ul>
        </div>

        {/* Output Console */}
        <div style={{
          background: '#1a202c',
          borderRadius: '12px',
          padding: '20px',
          minHeight: '300px',
          maxHeight: '500px',
          overflowY: 'auto',
          fontFamily: 'Monaco, Consolas, monospace',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#e2e8f0'
        }}>
          {testOutput.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#718096'
            }}>
              Click a test button to start...
            </div>
          ) : (
            testOutput.map((log, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '8px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #2d3748'
                }}
              >
                {log}
              </div>
            ))
          )}
        </div>

        {/* Navigation */}
        <div style={{
          marginTop: '30px',
          textAlign: 'center'
        }}>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#f7fafc',
              color: '#2d3748',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              border: '2px solid #e2e8f0',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#edf2f7';
              e.currentTarget.style.borderColor = '#cbd5e0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f7fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            ← Back to FlowForge
          </a>
        </div>

        {/* Documentation Links */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: '#faf5ff',
          borderRadius: '12px',
          border: '2px solid #d6bcfa'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#553c9a',
            marginBottom: '12px'
          }}>
            📚 Documentation
          </h3>
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            color: '#44337a',
            lineHeight: '1.8'
          }}>
            <li><code>PHASE-3-COMPLETE.md</code> - Quick start guide</li>
            <li><code>docs/PHASE-3-SETUP-GUIDE.md</code> - Setup instructions</li>
            <li><code>lib/supabase/README.md</code> - Developer reference</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

