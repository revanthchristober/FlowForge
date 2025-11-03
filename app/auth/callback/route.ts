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
 * 4. Session cookies are set automatically via @supabase/ssr
 * 5. Trigger auto-creates profile in public.users
 * 6. Redirect to main app
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

  // If no code provided, this is likely a direct visit (not from OAuth flow)
  // Redirect silently to signin without showing error
  if (!code) {
    console.log('ℹ️ Direct access to /auth/callback (no code) - redirecting to /signin');
    
    // Silent redirect - no error message for direct access
    const redirectUrl = new URL('/signin', requestUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Create Supabase client for server-side auth with proper cookie handling
    const cookieStore = await cookies();
    
    // Create response object first so we can set cookies on it
    const redirectUrl = new URL('/', requestUrl.origin);
    const response = NextResponse.redirect(redirectUrl);
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              // Set cookie in cookieStore
              cookieStore.set(name, value, options);
              // Also set cookie in response headers
              response.cookies.set(name, value, options);
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
              response.cookies.set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Exchange code for session - this will automatically set cookies via the handlers above
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('❌ Code exchange error:', exchangeError.message);
      
      const errorRedirectUrl = new URL('/signin', requestUrl.origin);
      errorRedirectUrl.searchParams.set('error', 'Authentication failed. Please try again.');
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    if (!data.session) {
      console.error('❌ No session created');
      
      const errorRedirectUrl = new URL('/signin', requestUrl.origin);
      errorRedirectUrl.searchParams.set('error', 'Failed to create session');
      
      return NextResponse.redirect(errorRedirectUrl);
    }

    console.log('✅ OAuth session created for:', data.user.email);
    console.log('✅ Redirecting to home page (/)');

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
        // Get Google avatar from multiple possible metadata fields
        const googleAvatar = data.user.user_metadata?.avatar_url || 
                            data.user.user_metadata?.picture ||
                            (data.user as any).raw_app_meta_data?.avatar_url ||
                            (data.user as any).raw_app_meta_data?.picture ||
                            null;
        
        const { error: insertError } = await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.full_name || 
                data.user.user_metadata?.name || 
                data.user.email!.split('@')[0],
          avatar_url: googleAvatar,
        });

        if (!insertError) {
          console.log('✅ User profile created manually');
        }
      }
    }

    // Return response with cookies already set via the cookie handlers above
    // This redirects to home page (/) with session cookies in place
    return response;

  } catch (error) {
    console.error('❌ OAuth callback exception:', error);
    
    const redirectUrl = new URL('/signin', requestUrl.origin);
    redirectUrl.searchParams.set('error', 'An unexpected error occurred');
    
    return NextResponse.redirect(redirectUrl);
  }
}

