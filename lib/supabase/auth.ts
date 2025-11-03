/**
 * Supabase Authentication Helper Functions
 * 
 * Provides convenient wrappers around Supabase Auth API
 * for email/password and OAuth authentication flows.
 * 
 * Features:
 * - Email/Password sign up and sign in
 * - Google OAuth authentication
 * - Session management
 * - Password reset
 * - User profile verification
 */

import { supabase } from './client';
import type { User, Session } from '@supabase/supabase-js';

/**
 * Auth response type
 */
export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

/**
 * Sign up a new user with email and password
 * 
 * @param email - User's email address
 * @param password - User's password (min 6 characters recommended)
 * @param name - User's full name (stored in user_metadata)
 * @returns Promise<AuthResponse> - User, session, and any error
 * 
 * Process:
 * 1. Creates user in auth.users table
 * 2. Trigger auto-creates profile in public.users table
 * 3. Returns session if email confirmation disabled
 * 4. Otherwise, user must confirm email first
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name, // Stored in user_metadata, used by trigger
        },
      },
    });

    if (error) {
      console.error('❌ Sign up error:', error.message);
      return {
        user: null,
        session: null,
        error: new Error(error.message),
      };
    }

    console.log('✅ User signed up:', data.user?.email);
    
    // Verify profile was created (optional check)
    if (data.user) {
      setTimeout(async () => {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user!.id)
          .single();

        if (profileError || !profile) {
          console.warn('⚠️ Profile not auto-created, creating manually...');
          await supabase.from('users').insert({
            id: data.user!.id,
            email: data.user!.email!,
            name: data.user!.user_metadata?.name || email.split('@')[0],
          });
        } else {
          console.log('✅ User profile created:', profile.email);
        }
      }, 1000); // Small delay for trigger to execute
    }

    return {
      user: data.user,
      session: data.session,
      error: null,
    };
  } catch (error) {
    console.error('❌ Sign up exception:', error);
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Sign in an existing user with email and password
 * 
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise<AuthResponse> - User, session, and any error
 * 
 * Common errors:
 * - Invalid credentials
 * - Email not confirmed
 * - User not found
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Sign in error:', error.message);
      
      // Map Supabase errors to user-friendly messages
      let errorMessage = error.message;
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email or password is incorrect';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email before signing in';
      }
      
      return {
        user: null,
        session: null,
        error: new Error(errorMessage),
      };
    }

    console.log('✅ User signed in:', data.user?.email);

    return {
      user: data.user,
      session: data.session,
      error: null,
    };
  } catch (error) {
    console.error('❌ Sign in exception:', error);
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error('Connection failed. Please try again.'),
    };
  }
}

/**
 * Sign in with Google OAuth
 * 
 * @param redirectTo - URL to redirect to after authentication (default: window.location.origin)
 * @returns Promise<{ error: Error | null }> - Error if OAuth initiation fails
 * 
 * Process:
 * 1. Redirects to Google consent screen
 * 2. User approves permissions
 * 3. Google redirects to /auth/callback with code
 * 4. Callback handler exchanges code for session
 * 5. Trigger creates profile in public.users
 * 6. User redirected to main app
 */
export async function signInWithGoogle(redirectTo?: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('❌ Google OAuth error:', error.message);
      return { error: new Error(error.message) };
    }

    // Redirect happens automatically
    console.log('🔄 Redirecting to Google...');
    return { error: null };
  } catch (error) {
    console.error('❌ Google OAuth exception:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to initiate Google sign in'),
    };
  }
}

/**
 * Sign out the current user
 * 
 * @returns Promise<{ error: Error | null }> - Error if sign out fails
 * 
 * Process:
 * - Clears session from localStorage
 * - Revokes refresh token on server
 * - Triggers SIGNED_OUT auth event
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Sign out error:', error.message);
      return { error: new Error(error.message) };
    }

    console.log('✅ User signed out');
    return { error: null };
  } catch (error) {
    console.error('❌ Sign out exception:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to sign out'),
    };
  }
}

/**
 * Get the current session
 * 
 * @returns Promise<Session | null> - Current session or null
 * 
 * Use this for route guards and session checks.
 * Faster than getUser() as it doesn't validate JWT.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Get session error:', error.message);
      return null;
    }

    return session;
  } catch (error) {
    console.error('❌ Get session exception:', error);
    return null;
  }
}

/**
 * Get the current authenticated user
 * 
 * @returns Promise<User | null> - Current user or null
 * 
 * This validates the JWT token, use getSession() for faster checks.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('❌ Get user error:', error.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error('❌ Get user exception:', error);
    return null;
  }
}

/**
 * Send password reset email
 * 
 * @param email - User's email address
 * @returns Promise<{ error: Error | null }> - Error if request fails
 * 
 * User will receive an email with a reset link.
 * Link will redirect to your app where they can set a new password.
 */
export async function resetPassword(email: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('❌ Password reset error:', error.message);
      return { error: new Error(error.message) };
    }

    console.log('✅ Password reset email sent to:', email);
    return { error: null };
  } catch (error) {
    console.error('❌ Password reset exception:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to send reset email'),
    };
  }
}

/**
 * Check if user profile exists in public.users table
 * 
 * @param userId - User's UUID
 * @returns Promise<boolean> - True if profile exists
 * 
 * Used to verify trigger function worked correctly.
 * If false, you may need to manually create the profile.
 */
export async function checkUserProfile(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('⚠️ Profile check error:', error.message);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('❌ Profile check exception:', error);
    return false;
  }
}

/**
 * Manually create user profile (fallback if trigger fails)
 * 
 * @param user - Supabase auth user object
 * @returns Promise<boolean> - True if profile created successfully
 * 
 * Use this as a fallback if the trigger function fails.
 * Typically called after signup if checkUserProfile returns false.
 */
export async function createUserProfile(user: User): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').insert({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name || user.email!.split('@')[0],
      avatar_url: user.user_metadata?.avatar_url || null,
    });

    if (error) {
      console.error('❌ Profile creation error:', error.message);
      return false;
    }

    console.log('✅ User profile created manually:', user.email);
    return true;
  } catch (error) {
    console.error('❌ Profile creation exception:', error);
    return false;
  }
}

/**
 * Validation helper: Check if email is valid format
 * 
 * @param email - Email address to validate
 * @returns boolean - True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validation helper: Calculate password strength
 * 
 * @param password - Password to check
 * @returns 'weak' | 'medium' | 'strong'
 */
export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak';
  
  let strength = 0;
  
  // Length check
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  
  // Character variety checks
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  if (strength <= 2) return 'weak';
  if (strength <= 4) return 'medium';
  return 'strong';
}

/**
 * Map Supabase error codes to user-friendly messages
 * 
 * @param error - Supabase error object or message
 * @returns string - User-friendly error message
 */
export function mapAuthError(error: any): string {
  const message = error?.message || error?.toString() || 'Unknown error';
  
  // Common Supabase auth errors
  if (message.includes('Invalid login credentials')) {
    return 'Email or password is incorrect';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email before signing in';
  }
  if (message.includes('User already registered')) {
    return 'This email is already registered. Try signing in instead.';
  }
  if (message.includes('Password should be at least 6 characters')) {
    return 'Password must be at least 6 characters';
  }
  if (message.includes('Unable to validate email address')) {
    return 'Please enter a valid email address';
  }
  if (message.includes('Email rate limit exceeded')) {
    return 'Too many attempts. Please try again in a few minutes.';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Connection failed. Please check your internet and try again.';
  }
  
  // Return original message if no mapping found
  return message;
}

