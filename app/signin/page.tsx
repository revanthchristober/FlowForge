'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmail, signInWithGoogle, isValidEmail, mapAuthError } from '@/lib/supabase/auth';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Check for error in URL params (from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError) {
      setError(urlError);
      showToast(urlError, 'error');
      // Clean URL
      window.history.replaceState({}, '', '/signin');
    }
  }, []);

  // Material You Color Tokens (matching existing app)
  const colors = {
    primary: "#6750A4",
    primaryContainer: "#EADDFF",
    secondary: "#625B71",
    secondaryContainer: "#E8DEF8",
    surface: "#FEF7FF",
    surfaceVariant: "#E7E0EC",
    surfaceContainerHigh: "#ECE6F0",
    onSurface: "#1D1B20",
    onSurfaceVariant: "#49454F",
    outline: "#79747E",
    error: "#B3261E",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { user, session, error: authError } = await signInWithEmail(email, password);

      if (authError) {
        setError(mapAuthError(authError));
        showToast(mapAuthError(authError), 'error');
        setLoading(false);
        return;
      }

      if (user && session) {
        showToast('Welcome back! Redirecting...', 'success');
        setTimeout(() => {
          router.push('/');
        }, 500);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      showToast('An unexpected error occurred', 'error');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    const { error: authError } = await signInWithGoogle();

    if (authError) {
      setError(mapAuthError(authError));
      showToast(mapAuthError(authError), 'error');
      setLoading(false);
    }
    // If successful, redirect happens automatically
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        padding: '20px',
        fontFamily: 'Roboto, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Auth Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '450px',
          background: colors.surface,
          borderRadius: '28px',
          padding: '40px',
          boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px 0px rgba(0,0,0,0.3)',
          animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Logo & Branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>⚡</div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '600',
              color: colors.onSurface,
              margin: '0 0 8px 0',
            }}
          >
            Welcome Back!
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: colors.onSurfaceVariant,
              margin: 0,
            }}
          >
            Sign in to FlowForge Studio
          </p>
        </div>

        {/* Sign In Form */}
        <form onSubmit={handleEmailSignIn}>
          {/* Email Input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: colors.onSurface,
                marginBottom: '8px',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              style={{
                width: '100%',
                height: '56px',
                padding: '16px',
                border: `1px solid ${colors.outline}`,
                borderRadius: '12px',
                fontSize: '16px',
                background: colors.surface,
                color: colors.onSurface,
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.outline)}
            />
          </div>

          {/* Password Input */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: colors.onSurface,
                marginBottom: '8px',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '56px',
                  padding: '16px',
                  paddingRight: '48px',
                  border: `1px solid ${colors.outline}`,
                  borderRadius: '12px',
                  fontSize: '16px',
                  background: colors.surface,
                  color: colors.onSurface,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.primary)}
                onBlur={(e) => (e.currentTarget.style.borderColor = colors.outline)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '8px',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Forgot Password Link */}
          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                showToast('Password reset coming soon!', 'success');
              }}
              style={{
                fontSize: '14px',
                color: colors.primary,
                textDecoration: 'none',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Forgot password?
            </a>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: colors.errorContainer,
                border: `1px solid ${colors.error}`,
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'shake 0.4s ease-in-out',
              }}
            >
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span style={{ fontSize: '14px', color: colors.error }}>{error}</span>
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              background: loading ? colors.surfaceContainerHigh : colors.primary,
              color: loading ? colors.outline : '#FFFFFF',
              border: 'none',
              borderRadius: '24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0px 2px 6px 2px rgba(0,0,0,0.15)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#7D5AAF';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0px 4px 8px 3px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = colors.primary;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0px 2px 6px 2px rgba(0,0,0,0.15)';
              }
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '3px solid rgba(255,255,255,0.3)',
                    borderTop: '3px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            margin: '24px 0',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: colors.outline }} />
          <span style={{ fontSize: '14px', color: colors.onSurfaceVariant }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: colors.outline }} />
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            height: '48px',
            background: colors.surface,
            color: colors.onSurface,
            border: `2px solid ${colors.outline}`,
            borderRadius: '24px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = colors.surfaceContainerHigh;
              e.currentTarget.style.borderColor = colors.primary;
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = colors.surface;
              e.currentTarget.style.borderColor = colors.outline;
            }
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z"
              fill="#4285F4"
            />
            <path
              d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z"
              fill="#34A853"
            />
            <path
              d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z"
              fill="#FBBC05"
            />
            <path
              d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Sign Up Link */}
        <div
          style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '14px',
            color: colors.onSurfaceVariant,
          }}
        >
          Don't have an account?{' '}
          <a
            href="/signup"
            style={{
              color: colors.primary,
              textDecoration: 'none',
              fontWeight: '600',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Sign Up
          </a>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'success' ? colors.primaryContainer : colors.errorContainer,
            color: toast.type === 'success' ? colors.primary : colors.error,
            padding: '16px 24px',
            borderRadius: '28px',
            boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
            fontWeight: '500',
            minWidth: '288px',
            maxWidth: '560px',
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <span style={{ fontSize: '20px' }}>{toast.type === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }
        @media (max-width: 600px) {
          /* Mobile responsive adjustments */
          input,
          button {
            height: 52px;
          }
        }
      `}</style>
    </div>
  );
}

