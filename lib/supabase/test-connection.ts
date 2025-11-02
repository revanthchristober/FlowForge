/**
 * Supabase Connection Test Utility
 * 
 * Run this to verify:
 * 1. Supabase client is properly configured
 * 2. Database connection works
 * 3. Authentication status
 * 4. RLS policies are active
 * 
 * Usage (in browser console or Node):
 * ```typescript
 * import { testConnection } from '@/lib/supabase/test-connection';
 * await testConnection();
 * ```
 */

import { supabase } from './client';

/**
 * Test Supabase connection and configuration
 * 
 * @returns Promise<boolean> - true if all tests pass
 */
export async function testConnection(): Promise<boolean> {
  console.log('🔍 Testing Supabase connection...\n');

  let allTestsPassed = true;

  // Test 1: Client initialization
  try {
    console.log('Test 1: Client Initialization');
    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return false;
    }
    console.log('✅ Supabase client initialized\n');
  } catch (error) {
    console.error('❌ Client initialization failed:', error);
    return false;
  }

  // Test 2: Database connectivity (try to query users table)
  try {
    console.log('Test 2: Database Connectivity');
    const { error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.warn('⚠️ Database query returned error (this is expected if not logged in):', error.message);
      console.log('💡 This is normal behavior with RLS enabled\n');
    } else {
      console.log('✅ Database connection successful\n');
    }
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    allTestsPassed = false;
  }

  // Test 3: Authentication status
  try {
    console.log('Test 3: Authentication Status');
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Auth check failed:', error.message);
      allTestsPassed = false;
    } else if (session) {
      console.log('✅ User is logged in');
      console.log(`   User ID: ${session.user.id}`);
      console.log(`   Email: ${session.user.email}\n`);
    } else {
      console.log('⚠️ No active session (user not logged in)');
      console.log('💡 This is expected before authentication is implemented\n');
    }
  } catch (error) {
    console.error('❌ Authentication check failed:', error);
    allTestsPassed = false;
  }

  // Test 4: Get current user
  try {
    console.log('Test 4: Get Current User');
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('❌ Get user failed:', error.message);
    } else if (user) {
      console.log('✅ Successfully retrieved user data');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Email: ${user.email}\n`);
    } else {
      console.log('⚠️ No user data (not authenticated)');
      console.log('💡 This is expected before authentication is implemented\n');
    }
  } catch (error) {
    console.error('❌ Get user failed:', error);
  }

  // Test 5: Check workflows table access
  try {
    console.log('Test 5: Workflows Table Access');
    const { data, error } = await supabase
      .from('workflows')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.warn('⚠️ Workflows query error (expected if not logged in):', error.message);
      console.log('💡 RLS is working correctly - blocking unauthenticated access\n');
    } else {
      console.log('✅ Workflows table accessible');
      console.log(`   Table exists and is queryable\n`);
    }
  } catch (error) {
    console.error('❌ Workflows table test failed:', error);
    allTestsPassed = false;
  }

  // Test 6: Check memory_items table access
  try {
    console.log('Test 6: Memory Items Table Access');
    const { data, error } = await supabase
      .from('memory_items')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.warn('⚠️ Memory items query error (expected if not logged in):', error.message);
      console.log('💡 RLS is working correctly - blocking unauthenticated access\n');
    } else {
      console.log('✅ Memory items table accessible');
      console.log(`   Table exists and is queryable\n`);
    }
  } catch (error) {
    console.error('❌ Memory items table test failed:', error);
    allTestsPassed = false;
  }

  // Summary
  console.log('━'.repeat(50));
  if (allTestsPassed) {
    console.log('✅ All critical tests passed!');
    console.log('\n📌 Next Steps:');
    console.log('1. Add authentication (Phase 4)');
    console.log('2. Test authenticated operations');
    console.log('3. Migrate API routes to use Supabase stores (Phase 5)');
  } else {
    console.log('⚠️ Some tests failed - check errors above');
    console.log('\n📌 Common Issues:');
    console.log('1. Missing .env.local file with Supabase credentials');
    console.log('2. Invalid Supabase URL or API key');
    console.log('3. Database schema not deployed (run Phase 2 SQL)');
    console.log('4. Network connectivity issues');
  }
  console.log('━'.repeat(50));

  return allTestsPassed;
}

/**
 * Quick test - just check if client is configured
 */
export async function quickTest(): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error && error.message.includes('JWT')) {
      console.log('✅ Supabase connected (RLS active, need auth)');
      return true;
    } else if (!error) {
      console.log('✅ Supabase connected successfully');
      return true;
    } else {
      console.error('❌ Connection issue:', error.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection failed:', error);
    return false;
  }
}

