'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { signOut } from '@/lib/supabase/auth';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

interface AuthProviderInfo {
  provider: string; // 'email' | 'google' | etc.
  isOAuth: boolean; // true if OAuth provider (Google, etc.)
}

interface UserMenuProps {
  userEmail: string | null;
  colors: {
    primary: string;
    primaryContainer: string;
    secondary: string;
    secondaryContainer: string;
    surface: string;
    surfaceVariant: string;
    onSurface: string;
    outline: string;
    error: string;
    errorContainer: string;
    onErrorContainer: string;
  };
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

export default function UserMenu({ userEmail, colors, theme, onThemeChange, onShowToast }: UserMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user profile and Google avatar
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      try {
        // First, get the auth user to access user_metadata (Google profile data)
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authUser) {
          console.error('Error fetching auth user:', authError);
          setIsLoading(false);
          return;
        }

        // Get Google avatar from user_metadata (prioritize this)
        // Google OAuth stores avatar in: user_metadata.avatar_url or user_metadata.picture
        // Also check raw_app_meta_data which Supabase sometimes uses
        const googleAvatarUrl = authUser.user_metadata?.avatar_url || 
                                authUser.user_metadata?.picture ||
                                (authUser as any).raw_app_meta_data?.avatar_url ||
                                (authUser as any).raw_app_meta_data?.picture ||
                                null;

        // Debug logging (remove in production if needed)
        if (googleAvatarUrl) {
          console.log('✅ Found Google avatar:', googleAvatarUrl);
        } else {
          console.log('ℹ️ No Google avatar found in user_metadata:', {
            hasUserMetadata: !!authUser.user_metadata,
            userMetadataKeys: authUser.user_metadata ? Object.keys(authUser.user_metadata) : [],
          });
        }

        // Get profile from database
        const { data: dbProfile, error: dbError } = await supabase
          .from('users')
          .select('id, email, name, avatar_url')
          .eq('id', authUser.id)
          .single();

        if (dbError && dbError.code !== 'PGRST116') {
          // PGRST116 = no rows returned (not an error we care about)
          console.error('Error fetching profile from database:', dbError);
        }

        // Detect auth provider (email/password vs OAuth)
        // Check identities array or app_metadata.provider
        const identities = (authUser as any).identities || [];
        const provider = identities.length > 0 
          ? identities[0].provider 
          : (authUser.app_metadata?.provider || 'email');
        
        const providerInfo: AuthProviderInfo = {
          provider: provider,
          isOAuth: provider !== 'email', // OAuth if not 'email'
        };
        setAuthProvider(providerInfo);

        // Merge data: prioritize Google avatar from auth metadata, fallback to DB
        const profileData: UserProfile = {
          id: authUser.id,
          email: authUser.email || userEmail,
          name: dbProfile?.name || 
                authUser.user_metadata?.full_name ||
                authUser.user_metadata?.name ||
                authUser.user_metadata?.display_name ||
                null,
          // Prioritize Google avatar from auth metadata, then DB, then null
          avatar_url: googleAvatarUrl || dbProfile?.avatar_url || null,
        };

        // If we have Google avatar but not in DB, update DB for future use
        if (googleAvatarUrl && (!dbProfile || !dbProfile.avatar_url)) {
          // Silently update avatar_url in database (fire and forget)
          supabase
            .from('users')
            .update({ 
              avatar_url: googleAvatarUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', authUser.id)
            .then(({ error }) => {
              if (error) {
                console.warn('Failed to update avatar_url in database:', error);
              } else {
                console.log('✅ Updated avatar_url in database');
              }
            });
        }

        setProfile(profileData);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userEmail]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    const { error } = await signOut();
    if (!error) {
      router.push('/signin');
    } else {
      onShowToast('Failed to sign out', 'error');
    }
  };

  const getInitials = () => {
    if (profile?.name) {
      return profile.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (userEmail) {
      return userEmail[0].toUpperCase();
    }
    return '?';
  };

  const getAvatarUrl = () => {
    return profile?.avatar_url || null;
  };

  return (
    <>
      <div style={{ position: 'relative' }} ref={menuRef}>
        {/* Avatar Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.3)',
            background: profile?.avatar_url 
              ? `url(${profile.avatar_url}) center/cover`
              : colors.primary,
            color: profile?.avatar_url ? 'transparent' : '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: '600',
            transition: 'all 0.2s',
            boxShadow: isOpen ? '0 4px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
            transform: isOpen ? 'scale(1.05)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            }
          }}
          title={profile?.name || userEmail || 'User'}
        >
          {!profile?.avatar_url && getInitials()}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '48px',
              right: '0',
              minWidth: '200px',
              background: theme === 'dark' ? '#1D1B20' : colors.surface,
              borderRadius: '12px',
              boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px 0px rgba(0,0,0,0.3)',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'slideDown 0.2s ease-out',
            }}
          >
            {/* User Info */}
            <div
              style={{
                padding: '16px',
                borderBottom: `1px solid ${colors.outline}20`,
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
                  marginBottom: '4px',
                }}
              >
                {profile?.name || 'User'}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: theme === 'dark' ? '#B0B0B0' : colors.onSurfaceVariant,
                }}
              >
                {userEmail}
              </div>
            </div>

            {/* Menu Items */}
            <div style={{ padding: '8px' }}>
              {/* Settings */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowSettings(true);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : colors.surfaceVariant;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: '18px' }}>⚙️</span>
                Settings
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => {
                  const newTheme = theme === 'light' ? 'dark' : 'light';
                  onThemeChange(newTheme);
                  onShowToast(`Switched to ${newTheme} theme`, 'success');
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : colors.surfaceVariant;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: '18px' }}>
                  {theme === 'light' ? '🌙' : '☀️'}
                </span>
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </button>

              {/* Divider */}
              <div
                style={{
                  height: '1px',
                  background: colors.outline + '40',
                  margin: '8px 0',
                }}
              />

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: colors.error,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.errorContainer;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: '18px' }}>🚪</span>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          profile={profile}
          authProvider={authProvider}
          onClose={() => setShowSettings(false)}
          onUpdate={(updatedProfile) => {
            setProfile(updatedProfile);
            onShowToast('Profile updated successfully!', 'success');
          }}
          colors={colors}
          theme={theme}
          onShowToast={onShowToast}
        />
      )}

      {/* Animation */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

// Settings Modal Component
interface SettingsModalProps {
  profile: UserProfile | null;
  authProvider: AuthProviderInfo | null;
  onClose: () => void;
  onUpdate: (profile: UserProfile) => void;
  colors: UserMenuProps['colors'];
  theme: 'light' | 'dark';
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

function SettingsModal({ profile, authProvider, onClose, onUpdate, colors, theme, onShowToast }: SettingsModalProps) {
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Check if email can be edited (only for email/password accounts, not OAuth)
  const canEditEmail = authProvider?.provider === 'email' && !authProvider?.isOAuth;

  // Update state when profile changes
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  // Email validation helper
  const validateEmailFormat = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validate email if it's editable and changed
    if (canEditEmail && email !== profile.email) {
      if (!email.trim()) {
        setEmailError('Email is required');
        return;
      }
      if (!validateEmailFormat(email)) {
        setEmailError('Please enter a valid email address');
        return;
      }
    }

    setIsSaving(true);
    setEmailError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onShowToast('Not authenticated', 'error');
        setIsSaving(false);
        return;
      }

      // Update email in auth if changed and editable
      let emailUpdated = false;
      if (canEditEmail && email.trim() !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email.trim(),
        });

        if (emailError) {
          console.error('Error updating email:', emailError);
          setEmailError(emailError.message || 'Failed to update email');
          setIsSaving(false);
          return;
        }

        emailUpdated = true;
        
        // Email change requires verification
        // Supabase will send a verification email automatically
        onShowToast(
          'Email updated! Please check your new email to verify it.',
          'success'
        );
      }

      // Update name and email in database
      const updateData: any = {
        name: name.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Only update email in DB if it was successfully updated in auth
      if (emailUpdated) {
        updateData.email = email.trim();
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        onShowToast('Failed to update profile', 'error');
      } else if (data) {
        onUpdate(data);
        // Only close if email wasn't changed (to show verification message)
        if (!emailUpdated) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      onShowToast('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme === 'dark' ? '#1D1B20' : colors.surface,
          borderRadius: '28px',
          padding: '32px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
          animation: 'scaleIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: '600',
            color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
            margin: '0 0 24px 0',
          }}
        >
          Edit FlowForge Account
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
              marginBottom: '8px',
            }}
          >
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            disabled={isSaving}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1px solid ${colors.outline}`,
              borderRadius: '12px',
              fontSize: '16px',
              background: theme === 'dark' ? '#2C2C2C' : colors.surface,
              color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
              outline: 'none',
              boxSizing: 'border-box',
              opacity: isSaving ? 0.7 : 1,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = colors.primary)}
            onBlur={(e) => (e.currentTarget.style.borderColor = colors.outline)}
          />
        </div>

        {/* Email field - only for email/password accounts */}
        {canEditEmail ? (
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
                marginBottom: '8px',
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="Enter your email"
              disabled={isSaving}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `1px solid ${emailError ? colors.error : colors.outline}`,
                borderRadius: '12px',
                fontSize: '16px',
                background: theme === 'dark' ? '#2C2C2C' : colors.surface,
                color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
                outline: 'none',
                boxSizing: 'border-box',
                opacity: isSaving ? 0.7 : 1,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = emailError ? colors.error : colors.outline)}
            />
            {emailError && (
              <div
                style={{
                  fontSize: '12px',
                  color: colors.error,
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>⚠️</span>
                {emailError}
              </div>
            )}
            <div
              style={{
                fontSize: '12px',
                color: theme === 'dark' ? '#B0B0B0' : colors.onSurfaceVariant,
                marginTop: '4px',
              }}
            >
              ℹ️ Changing your email requires verification
            </div>
          </div>
        ) : (
          /* Read-only email for OAuth accounts */
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
                marginBottom: '8px',
              }}
            >
              Email Address
            </label>
            <div
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `1px solid ${colors.outline}40`,
                borderRadius: '12px',
                fontSize: '16px',
                background: theme === 'dark' ? '#2C2C2C' : colors.surfaceVariant,
                color: theme === 'dark' ? '#B0B0B0' : colors.onSurfaceVariant,
                boxSizing: 'border-box',
              }}
            >
              {profile?.email || 'No email'}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: theme === 'dark' ? '#B0B0B0' : colors.onSurfaceVariant,
                marginTop: '4px',
              }}
            >
              ℹ️ Email is managed by {authProvider?.provider === 'google' ? 'Google' : 'your OAuth provider'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: theme === 'dark' ? '#FFFFFF' : colors.onSurface,
              border: `1px solid ${colors.outline}`,
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '10px 20px',
              background: colors.primary,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
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
      `}</style>
    </div>
  );
}

