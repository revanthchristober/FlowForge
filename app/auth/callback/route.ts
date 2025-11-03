/**
 * OAuth Callback Handler
 * 
 * Handles the OAuth redirect from Google (or other providers).
 * Exchanges the authorization code for a session and redirects to the app.
 * 
 * Flow:
 * 1. User authenticates with Google
 * 2. Google redirects to this endpoint with code
 * 3. We exchange code for session using Supabase
 * 4. Trigger auto-creates profile in public.users
 * 5. Redirect to main app
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors (user cancelled, etc.)
  if (error) {
    console.error('❌ OAuth error:', error, errorDescription);
    
    const redirectUrl = new URL('/signin', requestUrl.origin);
    redirectUrl.searchParams.set('error', errorDescription || 'Authentication failed');
    
    return NextResponse.redirect(redirectUrl);
  }

  // Code is required for OAuth flow
  if (!code) {
    console.error('❌ No authorization code provided');
    
    const redirectUrl = new URL('/signin', requestUrl.origin);
    redirectUrl.searchParams.set('error', 'No authorization code provided');
    
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Create Supabase client for server-side auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'pkce',
        },
      }
    );

    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('❌ Code exchange error:', exchangeError.message);
      
      const redirectUrl = new URL('/signin', requestUrl.origin);
      redirectUrl.searchParams.set('error', 'Authentication failed. Please try again.');
      
      return NextResponse.redirect(redirectUrl);
    }

    if (!data.session) {
      console.error('❌ No session created');
      
      const redirectUrl = new URL('/signin', requestUrl.origin);
      redirectUrl.searchParams.set('error', 'Failed to create session');
      
      return NextResponse.redirect(redirectUrl);
    }

    console.log('✅ OAuth session created for:', data.user.email);

    // Verify user profile was created (the trigger should handle this)
    // We don't need to manually create it here, just log for debugging
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        console.log('✅ User profile exists:', profile.email);
      } else {
        console.warn('⚠️ User profile not found (trigger may need time):', profileError?.message);
        
        // Manually create profile as fallback
        const { error: insertError } = await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.full_name || 
                data.user.user_metadata?.name || 
                data.user.email!.split('@')[0],
          avatar_url: data.user.user_metadata?.avatar_url || null,
        });

        if (!insertError) {
          console.log('✅ User profile created manually');
        }
      }
    }

    // Successful authentication - redirect to main app
    const redirectUrl = new URL('/', requestUrl.origin);
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ OAuth callback exception:', error);
    
    const redirectUrl = new URL('/signin', requestUrl.origin);
    redirectUrl.searchParams.set('error', 'An unexpected error occurred');
    
    return NextResponse.redirect(redirectUrl);
  }
}

