# 🔐 Phase 4: Authentication Implementation Checklist

**Status:** Planning Phase (NO EDITS YET)  
**Routes:** `/signin` and `/signup` (separate pages)  
**Auth Providers:** Email/Password + Google OAuth  
**Design:** Material You (matching existing FlowForge UI)

---

## 📊 Current State Analysis

### ✅ Material You Design System (Extracted from Codebase)

```typescript
// Your existing color palette
const colors = {
  primary: "#6750A4",           // Purple primary
  primaryContainer: "#EADDFF",   // Light purple container
  secondary: "#625B71",          // Purple-gray secondary
  secondaryContainer: "#E8DEF8", // Light purple-gray
  surface: "#FEF7FF",           // Almost white surface
  surfaceVariant: "#E7E0EC",    // Light gray-purple
  onSurface: "#1D1B20",         // Dark text
  outline: "#79747E",           // Medium gray
  error: "#B3261E",             // Red error
  errorContainer: "#F9DEDC",    // Light red container
  onErrorContainer: "#410E0B",  // Dark red text
};

// Your existing elevation shadows
const elevations = {
  level1: "0px 1px 2px 0px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)",
  level2: "0px 1px 2px 0px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)",
  level3: "0px 1px 3px 0px rgba(0,0,0,0.3), 0px 4px 8px 3px rgba(0,0,0,0.15)",
};

// Your animation patterns
@keyframes slideUp / fadeIn / scaleIn
```

### ✅ Current Database Schema (From Supabase)

```sql
-- Users table (already created in Phase 2)
CREATE TABLE public.users (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies (already enabled)
- Users can view own profile
- Users can update own profile
- Users can insert own profile (on signup)

-- Trigger function (already created)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

### ✅ Supabase Auth Methods Available

From Context7 research:
```typescript
// Email/Password Sign Up
supabase.auth.signUp({
  email: string,
  password: string,
  options: {
    data: { name: string } // user_metadata
  }
})

// Email/Password Sign In
supabase.auth.signInWithPassword({
  email: string,
  password: string
})

// Google OAuth
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'http://localhost:3000/auth/callback'
  }
})

// Session Management
supabase.auth.getSession()
supabase.auth.getUser()
supabase.auth.signOut()
supabase.auth.onAuthStateChange((event, session) => {})
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 4.1: Supabase Configuration**

#### **Prerequisites**
- [ ] **P4.1.1**: Verify Supabase project URL and keys in `.env.local`
- [ ] **P4.1.2**: Enable Email provider in Supabase dashboard
  - Path: Authentication → Providers → Email
  - Enable "Confirm email" (optional for development)
  - Set "Site URL" to `http://localhost:3000`
- [ ] **P4.1.3**: Enable Google OAuth provider
  - Path: Authentication → Providers → Google
  - Add Google OAuth credentials (Client ID & Secret)
  - Set "Authorized redirect URIs" to: `https://[PROJECT_ID].supabase.co/auth/v1/callback`
- [ ] **P4.1.4**: Configure redirect URLs
  - Add `http://localhost:3000/auth/callback` to allowed URLs
  - Add `http://localhost:3000` to site URL
- [ ] **P4.1.5**: Verify trigger function `handle_new_user()` is active
  - Test: Sign up a test user and check `public.users` table
  - Should auto-create profile on signup

---

### **Phase 4.2: File Structure Setup**

#### **New Files to Create**
- [ ] **F4.2.1**: `app/signin/page.tsx` - Sign In page
- [ ] **F4.2.2**: `app/signup/page.tsx` - Sign Up page  
- [ ] **F4.2.3**: `app/auth/callback/route.ts` - OAuth callback handler
- [ ] **F4.2.4**: `lib/supabase/auth.ts` - Auth helper functions
- [ ] **F4.2.5**: `components/AuthLayout.tsx` - Shared auth page layout (optional)
- [ ] **F4.2.6**: `hooks/useAuth.ts` - Auth state management hook (optional)

#### **Files to Update**
- [ ] **U4.2.1**: `app/page.tsx` - Add auth check & redirect
- [ ] **U4.2.2**: `app/test-supabase/page.tsx` - Add auth check (optional)

---

### **Phase 4.3: Auth Helper Functions**

#### **File: `lib/supabase/auth.ts`**

Functions to implement:

- [ ] **A4.3.1**: `signUpWithEmail(email, password, name)`
  ```typescript
  - Call supabase.auth.signUp()
  - Pass user_metadata: { name }
  - Handle email confirmation flow
  - Return { user, session, error }
  ```

- [ ] **A4.3.2**: `signInWithEmail(email, password)`
  ```typescript
  - Call supabase.auth.signInWithPassword()
  - Handle errors (invalid credentials, etc.)
  - Return { user, session, error }
  ```

- [ ] **A4.3.3**: `signInWithGoogle()`
  ```typescript
  - Call supabase.auth.signInWithOAuth({ provider: 'google' })
  - Set redirectTo to '/auth/callback'
  - Handle popup window or redirect
  ```

- [ ] **A4.3.4**: `signOut()`
  ```typescript
  - Call supabase.auth.signOut()
  - Clear local storage/session
  - Redirect to /signin
  ```

- [ ] **A4.3.5**: `getSession()`
  ```typescript
  - Call supabase.auth.getSession()
  - Return current session or null
  ```

- [ ] **A4.3.6**: `getCurrentUser()`
  ```typescript
  - Call supabase.auth.getUser()
  - Return user object or null
  ```

- [ ] **A4.3.7**: `resetPassword(email)`
  ```typescript
  - Call supabase.auth.resetPasswordForEmail()
  - Send password reset email
  ```

---

### **Phase 4.4: Sign In Page (`app/signin/page.tsx`)**

#### **Layout & Structure**
- [ ] **SI4.4.1**: Full-page centered layout with gradient background
- [ ] **SI4.4.2**: Material You card with elevation (level3)
- [ ] **SI4.4.3**: FlowForge logo/branding at top
- [ ] **SI4.4.4**: "Welcome Back" heading

#### **Form Elements**
- [ ] **SI4.4.5**: Email input field
  ```typescript
  - Type: email
  - Placeholder: "Email address"
  - Validation: Required, email format
  - Material You styling (rounded corners, outline on focus)
  - Icon: 📧 or envelope icon
  ```

- [ ] **SI4.4.6**: Password input field
  ```typescript
  - Type: password
  - Placeholder: "Password"
  - Validation: Required, min 6 characters
  - Toggle show/hide password (👁️ icon)
  - Material You styling
  ```

- [ ] **SI4.4.7**: "Remember me" checkbox (optional)
  ```typescript
  - Material You checkbox styling
  - Store preference in localStorage
  ```

- [ ] **SI4.4.8**: "Forgot password?" link
  ```typescript
  - Color: colors.primary
  - Hover: underline
  - Opens password reset modal/page
  ```

#### **Action Buttons**
- [ ] **SI4.4.9**: Primary "Sign In" button
  ```typescript
  - Full width
  - Background: colors.primary
  - Color: white
  - Border radius: 28px (pill shape)
  - Elevation: level2
  - Loading state: Show spinner, disable button
  - Hover: Darken & lift (elevation3)
  ```

- [ ] **SI4.4.10**: Divider with "OR" text
  ```typescript
  - Horizontal line with centered text
  - Color: colors.outline
  ```

- [ ] **SI4.4.11**: "Continue with Google" button
  ```typescript
  - Full width
  - Background: white or colors.surfaceVariant
  - Border: 2px solid colors.outline
  - Google logo icon
  - Hover: Background colors.surfaceContainerHigh
  ```

#### **Navigation**
- [ ] **SI4.4.12**: "Don't have an account? Sign Up" link
  ```typescript
  - Bottom of card
  - Navigate to /signup
  - Color: colors.primary
  ```

#### **State Management**
- [ ] **SI4.4.13**: Form state (email, password, loading, error)
- [ ] **SI4.4.14**: Client-side validation
  ```typescript
  - Email: regex pattern
  - Password: min length
  - Show inline errors below fields
  ```

- [ ] **SI4.4.15**: Error handling
  ```typescript
  - Invalid credentials: "Email or password is incorrect"
  - Network error: "Connection failed. Try again."
  - Email not confirmed: "Please confirm your email"
  - Display in Material You snackbar/toast
  ```

- [ ] **SI4.4.16**: Success redirect to `/` (main app)

#### **OAuth Flow**
- [ ] **SI4.4.17**: Handle Google OAuth button click
  ```typescript
  - Call signInWithGoogle()
  - Redirect to Google consent screen
  - Return to /auth/callback
  ```

#### **Animations**
- [ ] **SI4.4.18**: Card entrance: scaleIn animation (0.3s)
- [ ] **SI4.4.19**: Button hover: scale(1.02) + elevation increase
- [ ] **SI4.4.20**: Form field focus: border color transition
- [ ] **SI4.4.21**: Error shake animation (if invalid)

---

### **Phase 4.5: Sign Up Page (`app/signup/page.tsx`)**

#### **Layout & Structure** 
- [ ] **SU4.5.1**: Similar layout to Sign In (consistency)
- [ ] **SU4.5.2**: Material You card with elevation
- [ ] **SU4.5.3**: "Create Account" heading
- [ ] **SU4.5.4**: Welcome message/description

#### **Form Elements**
- [ ] **SU4.5.5**: Name input field
  ```typescript
  - Type: text
  - Placeholder: "Full name"
  - Validation: Required, min 2 characters
  - Material You styling
  - Icon: 👤 or person icon
  ```

- [ ] **SU4.5.6**: Email input field (same as Sign In)
- [ ] **SU4.5.7**: Password input field
  ```typescript
  - Same as Sign In
  - Show password strength indicator
  - Weak/Medium/Strong colors
  ```

- [ ] **SU4.5.8**: Confirm Password input field
  ```typescript
  - Type: password
  - Placeholder: "Confirm password"
  - Validation: Must match password
  - Show error if mismatch
  ```

- [ ] **SU4.5.9**: Terms & Privacy checkbox
  ```typescript
  - Required to submit
  - "I agree to Terms of Service and Privacy Policy"
  - Links open in new tab
  ```

#### **Action Buttons**
- [ ] **SU4.5.10**: Primary "Create Account" button (same style as Sign In)
- [ ] **SU4.5.11**: Divider with "OR"
- [ ] **SU4.5.12**: "Sign up with Google" button

#### **Navigation**
- [ ] **SU4.5.13**: "Already have an account? Sign In" link

#### **State Management**
- [ ] **SU4.5.14**: Form state (name, email, password, confirmPassword)
- [ ] **SU4.5.15**: Client-side validation
  ```typescript
  - Name: Not empty, min 2 chars
  - Email: Valid format
  - Password: Min 8 chars, complexity rules
  - Confirm password: Matches password
  - Terms: Must be checked
  ```

- [ ] **SU4.5.16**: Error handling
  ```typescript
  - Email already exists: "This email is already registered"
  - Weak password: "Password must be at least 8 characters"
  - Network error: "Registration failed. Try again."
  - Display errors in toast/snackbar
  ```

- [ ] **SU4.5.17**: Success handling
  ```typescript
  - Show "Account created!" message
  - If email confirmation required: "Check your email"
  - If auto-login: Redirect to /
  ```

#### **Password Strength Indicator**
- [ ] **SU4.5.18**: Visual strength bar
  ```typescript
  - Red: Weak (< 8 chars)
  - Orange: Medium (8+ chars, no special)
  - Green: Strong (8+ chars, special + number)
  - Show below password field
  ```

#### **Google OAuth Signup**
- [ ] **SU4.5.19**: Same flow as Sign In
- [ ] **SU4.5.20**: Auto-extract name from Google profile
- [ ] **SU4.5.21**: Create profile in `public.users` via trigger

---

### **Phase 4.6: OAuth Callback Handler**

#### **File: `app/auth/callback/route.ts`**

- [ ] **CB4.6.1**: Handle OAuth redirect
  ```typescript
  - Extract code from URL params
  - Exchange code for session
  - Set session cookie
  ```

- [ ] **CB4.6.2**: Verify session is valid
  ```typescript
  - Check supabase.auth.getSession()
  - If valid: redirect to /
  - If invalid: redirect to /signin with error
  ```

- [ ] **CB4.6.3**: Handle errors
  ```typescript
  - OAuth denied: "Google sign-in cancelled"
  - Invalid state: "Authentication error"
  - Redirect to /signin with error message
  ```

- [ ] **CB4.6.4**: Create user profile (if new user)
  ```typescript
  - Trigger function should auto-create
  - Verify profile exists in public.users
  - If not, manually insert
  ```

#### **Implementation Structure**
```typescript
export async function GET(request: Request) {
  // Parse URL for code and error params
  // Exchange code for session
  // Redirect to / or /signin based on result
}
```

---

### **Phase 4.7: Protected Routes (Auth Guards)**

#### **Update: `app/page.tsx`**

- [ ] **PG4.7.1**: Add auth check on mount
  ```typescript
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/signin');
      }
    };
    checkAuth();
  }, []);
  ```

- [ ] **PG4.7.2**: Add auth state listener
  ```typescript
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/signin');
      }
    }
  );
  return () => subscription.unsubscribe();
  ```

- [ ] **PG4.7.3**: Show loading state while checking auth
  ```typescript
  - Display splash screen or spinner
  - Prevent flash of protected content
  ```

- [ ] **PG4.7.4**: Add user menu/profile dropdown (optional)
  ```typescript
  - Display user name/email
  - Sign out button
  - Settings link
  ```

#### **Update: `app/test-supabase/page.tsx`** (Optional)

- [ ] **PG4.7.5**: Add same auth check
- [ ] **PG4.7.6**: Show authenticated user info in test results

---

### **Phase 4.8: UI Components & Styling**

#### **Material You Form Inputs**
- [ ] **UI4.8.1**: Create reusable `<TextInput>` component
  ```typescript
  Props: type, placeholder, value, onChange, error, icon
  - Outlined style (1px border)
  - Border color: outline → primary on focus
  - Border radius: 12px
  - Padding: 12px 16px
  - Font size: 14px
  - Transition: border-color 0.2s
  ```

- [ ] **UI4.8.2**: Create `<Button>` component variants
  ```typescript
  Variants:
  - Primary: filled with primary color
  - Secondary: outlined with secondary color
  - Text: no background, primary text color
  - Loading: show spinner, disabled
  ```

- [ ] **UI4.8.3**: Create `<Checkbox>` component
  ```typescript
  - Material You checkbox styling
  - Ripple effect on click
  - Check animation
  ```

- [ ] **UI4.8.4**: Create `<PasswordInput>` component
  ```typescript
  - TextInput with show/hide toggle
  - Eye icon (👁️ / 👁️‍🗨️)
  - Toggle password visibility
  ```

#### **Toast/Snackbar Notifications**
- [ ] **UI4.8.5**: Reuse existing toast component from `app/page.tsx`
  ```typescript
  - Same Material You styling
  - Success: primaryContainer bg, primary text
  - Error: errorContainer bg, error text
  - Position: bottom center
  - Auto-dismiss after 3s
  ```

#### **Loading States**
- [ ] **UI4.8.6**: Create `<Spinner>` component
  ```typescript
  - Circular spinner
  - Color: colors.primary
  - Size variants: small, medium, large
  - Smooth rotation animation
  ```

- [ ] **UI4.8.7**: Button loading state
  ```typescript
  - Replace button text with spinner
  - Disable button
  - Maintain button width (no layout shift)
  ```

#### **Background Gradients**
- [ ] **UI4.8.8**: Auth pages background
  ```typescript
  - Linear gradient similar to header
  - gradient(135deg, colors.primary 0%, colors.secondary 100%)
  - Or subtle animated gradient
  ```

---

### **Phase 4.9: Error Handling & Validation**

#### **Client-Side Validation**
- [ ] **V4.9.1**: Email validation regex
  ```typescript
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  - Show error: "Please enter a valid email"
  ```

- [ ] **V4.9.2**: Password strength validation
  ```typescript
  - Min 8 characters
  - At least 1 uppercase letter (optional)
  - At least 1 number (optional)
  - At least 1 special character (optional)
  ```

- [ ] **V4.9.3**: Name validation
  ```typescript
  - Min 2 characters
  - Max 50 characters
  - Letters, spaces, hyphens only
  ```

- [ ] **V4.9.4**: Real-time validation feedback
  ```typescript
  - Show errors on blur (not on every keystroke)
  - Clear errors when field is corrected
  - Disable submit until all valid
  ```

#### **Server-Side Error Handling**
- [ ] **V4.9.5**: Supabase error codes mapping
  ```typescript
  Error codes to handle:
  - user_already_exists
  - invalid_credentials
  - email_not_confirmed
  - weak_password
  - rate_limit_exceeded
  - network_error
  
  Map to user-friendly messages
  ```

- [ ] **V4.9.6**: Error logging
  ```typescript
  - Console.error for debugging
  - Optional: Send to error tracking (Sentry, etc.)
  ```

---

### **Phase 4.10: User Profile Management**

#### **Verify Profile Creation**
- [ ] **UP4.10.1**: Test trigger function
  ```sql
  -- Verify this runs on signup:
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  ```

- [ ] **UP4.10.2**: Test profile insertion
  ```typescript
  - Sign up new user
  - Check public.users table
  - Verify: id, email, name populated
  - Verify: created_at timestamp set
  ```

#### **Profile Data Mapping**
- [ ] **UP4.10.3**: Email signup → public.users
  ```typescript
  Source: auth.users
  - id → users.id (UUID)
  - email → users.email
  - raw_user_meta_data->>'name' → users.name
  ```

- [ ] **UP4.10.4**: Google OAuth → public.users
  ```typescript
  Source: Google profile
  - id → users.id
  - email → users.email
  - user_metadata.full_name or .name → users.name
  - user_metadata.avatar_url → users.avatar_url
  ```

#### **Fallback Handling**
- [ ] **UP4.10.5**: If trigger fails, manual insert
  ```typescript
  After signup, check if profile exists:
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (!profile) {
    // Manually insert
    await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || email.split('@')[0]
    });
  }
  ```

---

### **Phase 4.11: Session & Cookie Management**

#### **Session Storage**
- [ ] **SM4.11.1**: Use Supabase default session storage
  ```typescript
  - Sessions stored in localStorage by default
  - Secure: HttpOnly cookies (server-side option)
  - Auto-refresh: enabled by default
  ```

- [ ] **SM4.11.2**: Session persistence
  ```typescript
  - persistSession: true (default)
  - autoRefreshToken: true (default)
  - Sessions last 1 hour, auto-refresh before expiry
  ```

#### **Session Refresh**
- [ ] **SM4.11.3**: Handle token refresh
  ```typescript
  - Automatic via Supabase client
  - Fallback: Manual refresh on API error
  ```

- [ ] **SM4.11.4**: Handle expired sessions
  ```typescript
  - Redirect to /signin
  - Show "Session expired" message
  - Clear local storage
  ```

---

### **Phase 4.12: Security Best Practices**

#### **Password Security**
- [ ] **SEC4.12.1**: Enforce strong passwords
  ```typescript
  - Min 8 characters (configurable in Supabase)
  - No common passwords (Supabase validates)
  - Show strength indicator
  ```

- [ ] **SEC4.12.2**: Rate limiting
  ```typescript
  - Supabase auto rate-limits auth attempts
  - Handle rate_limit_exceeded error
  - Show "Too many attempts" message
  ```

#### **CSRF Protection**
- [ ] **SEC4.12.3**: Use Supabase PKCE flow
  ```typescript
  - Auto-enabled for OAuth
  - Prevents CSRF attacks
  ```

#### **XSS Protection**
- [ ] **SEC4.12.4**: Sanitize user inputs
  ```typescript
  - Never render user input as HTML
  - Use React's default escaping
  - Validate on server-side
  ```

#### **Email Verification**
- [ ] **SEC4.12.5**: Optional email confirmation
  ```typescript
  - Enable in Supabase: Auth → Settings
  - Users can't sign in until confirmed
  - Send confirmation email on signup
  - Handle confirmation link click
  ```

---

### **Phase 4.13: Responsive Design**

#### **Mobile-First Approach**
- [ ] **RD4.13.1**: Auth card responsive
  ```typescript
  - Desktop: max-width 450px, centered
  - Tablet: max-width 400px
  - Mobile: full width with 20px padding
  ```

- [ ] **RD4.13.2**: Form inputs touch-friendly
  ```typescript
  - Min height: 48px
  - Min touch target: 44x44px
  - Adequate spacing between fields
  ```

- [ ] **RD4.13.3**: Google button responsive
  ```typescript
  - Full width on mobile
  - Icon + text on desktop
  - Icon only on very narrow screens
  ```

#### **Breakpoints**
- [ ] **RD4.13.4**: Define breakpoints
  ```typescript
  - Mobile: < 600px
  - Tablet: 600px - 960px
  - Desktop: > 960px
  ```

---

### **Phase 4.14: Accessibility (a11y)**

#### **WCAG 2.1 AA Compliance**
- [ ] **A11Y4.14.1**: Keyboard navigation
  ```typescript
  - Tab through all form fields
  - Enter to submit form
  - Escape to close modals
  ```

- [ ] **A11Y4.14.2**: ARIA labels
  ```typescript
  - aria-label for icon buttons
  - aria-describedby for error messages
  - aria-invalid for invalid fields
  - aria-required for required fields
  ```

- [ ] **A11Y4.14.3**: Focus indicators
  ```typescript
  - Visible outline on focus
  - High contrast (colors.primary)
  - Never remove outline with CSS
  ```

- [ ] **A11Y4.14.4**: Screen reader support
  ```typescript
  - alt text for images
  - aria-live for error announcements
  - Semantic HTML (form, label, button)
  ```

- [ ] **A11Y4.14.5**: Color contrast
  ```typescript
  - Text: 4.5:1 contrast ratio
  - Buttons: 3:1 contrast ratio
  - Test with contrast checker
  ```

---

### **Phase 4.15: Testing Checklist**

#### **Manual Testing**
- [ ] **T4.15.1**: Sign up with email
  ```
  - Test valid email/password
  - Test invalid email format
  - Test weak password
  - Test password mismatch
  - Test existing email
  - Verify profile created in DB
  ```

- [ ] **T4.15.2**: Sign in with email
  ```
  - Test valid credentials
  - Test invalid email
  - Test wrong password
  - Test unconfirmed email (if enabled)
  - Verify redirect to /
  - Verify session persists on refresh
  ```

- [ ] **T4.15.3**: Sign up/in with Google
  ```
  - Test Google OAuth flow
  - Test consent screen
  - Test redirect back to app
  - Verify profile created with Google data
  - Test avatar_url populated
  ```

- [ ] **T4.15.4**: Session management
  ```
  - Test session persists across tabs
  - Test session expires after timeout
  - Test auto-refresh works
  - Test sign out clears session
  ```

- [ ] **T4.15.5**: Protected routes
  ```
  - Test / redirects to /signin when logged out
  - Test / accessible when logged in
  - Test direct URL access when logged out
  ```

- [ ] **T4.15.6**: Error handling
  ```
  - Test network offline
  - Test Supabase unreachable
  - Test rate limiting
  - Verify error messages display
  ```

#### **Cross-Browser Testing**
- [ ] **T4.15.7**: Test on Chrome
- [ ] **T4.15.8**: Test on Firefox
- [ ] **T4.15.9**: Test on Safari
- [ ] **T4.15.10**: Test on Edge

#### **Device Testing**
- [ ] **T4.15.11**: Test on desktop (1920x1080)
- [ ] **T4.15.12**: Test on tablet (iPad 768x1024)
- [ ] **T4.15.13**: Test on mobile (iPhone 375x667)

---

### **Phase 4.16: Documentation**

#### **Code Documentation**
- [ ] **DOC4.16.1**: Add JSDoc comments to auth functions
- [ ] **DOC4.16.2**: Document auth flow in README
- [ ] **DOC4.16.3**: Add inline comments for complex logic

#### **User Documentation**
- [ ] **DOC4.16.4**: Create "How to Sign Up" guide
- [ ] **DOC4.16.5**: Create "Forgot Password" guide
- [ ] **DOC4.16.6**: Create "Sign in with Google" guide

---

### **Phase 4.17: Performance Optimization**

#### **Code Splitting**
- [ ] **PERF4.17.1**: Dynamic import for auth pages
  ```typescript
  - Lazy load sign in/up pages
  - Reduce initial bundle size
  ```

#### **Image Optimization**
- [ ] **PERF4.17.2**: Optimize logos/images
  ```typescript
  - Use WebP format
  - Responsive images (srcset)
  - Lazy load non-critical images
  ```

#### **Network Optimization**
- [ ] **PERF4.17.3**: Minimize auth requests
  ```typescript
  - Cache session locally
  - Use getSession() not getUser() for checks
  - Debounce validation checks
  ```

---

## 🎯 IMPLEMENTATION PRIORITY

### **MVP (Must Have) - Phase 4A**
1. ✅ Email/Password Sign Up
2. ✅ Email/Password Sign In
3. ✅ Protected route on `/`
4. ✅ User profile creation in DB
5. ✅ Sign out functionality
6. ✅ Basic error handling
7. ✅ Material You styling

### **Enhanced (Should Have) - Phase 4B**
1. ✅ Google OAuth
2. ✅ OAuth callback handler
3. ✅ Password strength indicator
4. ✅ Remember me functionality
5. ✅ Loading states
6. ✅ Form validation
7. ✅ Toast notifications

### **Polish (Nice to Have) - Phase 4C**
1. ⭐ Forgot password flow
2. ⭐ Email confirmation
3. ⭐ User profile dropdown
4. ⭐ Settings page
5. ⭐ Profile picture upload
6. ⭐ Dark mode toggle
7. ⭐ Animations & transitions

---

## 📊 ESTIMATED EFFORT

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 4.1-4.3: Setup & Helpers | 15 tasks | 1-2 hours |
| 4.4-4.5: Sign In/Up Pages | 35 tasks | 3-4 hours |
| 4.6-4.7: OAuth & Guards | 10 tasks | 1-2 hours |
| 4.8-4.9: UI & Validation | 15 tasks | 2-3 hours |
| 4.10-4.12: Profile & Security | 12 tasks | 1-2 hours |
| 4.13-4.14: Responsive & a11y | 10 tasks | 1-2 hours |
| 4.15: Testing | 13 tasks | 2-3 hours |
| 4.16-4.17: Docs & Performance | 7 tasks | 1 hour |

**Total MVP (Phase 4A):** 4-6 hours  
**Total Enhanced (Phase 4A + 4B):** 8-12 hours  
**Total Complete (All phases):** 12-18 hours

---

## 🚀 RECOMMENDED IMPLEMENTATION ORDER

### **Session 1: Foundation (2-3 hours)**
1. Configure Supabase providers (Email + Google)
2. Create auth helper functions (`lib/supabase/auth.ts`)
3. Test helpers with console logs

### **Session 2: Sign In Page (2-3 hours)**
1. Create `/signin` page layout
2. Implement email/password form
3. Add Google OAuth button
4. Add error handling
5. Test sign in flow

### **Session 3: Sign Up Page (2-3 hours)**
1. Create `/signup` page (clone & modify Sign In)
2. Add name field & password confirmation
3. Add password strength indicator
4. Add terms checkbox
5. Test signup flow & profile creation

### **Session 4: OAuth & Protection (2-3 hours)**
1. Create OAuth callback handler
2. Add auth guard to main page
3. Test Google OAuth flow end-to-end
4. Add sign out functionality

### **Session 5: Polish & Test (2-3 hours)**
1. Add loading states
2. Improve error messages
3. Add toast notifications
4. Test all flows
5. Fix bugs

---

## ✅ DEFINITION OF DONE

Phase 4 is complete when:

- [ ] Users can sign up with email/password
- [ ] Users can sign in with email/password
- [ ] Users can sign up/in with Google OAuth
- [ ] User profiles auto-create in `public.users` table
- [ ] Main app (`/`) is protected (redirects to `/signin`)
- [ ] Sessions persist across page refreshes
- [ ] Users can sign out
- [ ] All forms have validation & error handling
- [ ] Material You design matches existing app
- [ ] All MVP tasks completed (Phase 4A)
- [ ] Basic testing passed (manual tests)
- [ ] Zero TypeScript errors
- [ ] Documentation updated

---

## 📚 REFERENCE LINKS

**Supabase Documentation:**
- Auth Methods: https://supabase.com/docs/guides/auth
- OAuth Providers: https://supabase.com/docs/guides/auth/social-login
- Email Auth: https://supabase.com/docs/guides/auth/auth-email
- Session Management: https://supabase.com/docs/guides/auth/sessions

**Material You Design:**
- Guidelines: https://m3.material.io/
- Components: https://m3.material.io/components
- Color System: https://m3.material.io/styles/color/overview

**Next.js:**
- Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Client Components: https://nextjs.org/docs/app/building-your-application/rendering/client-components

---

**Status:** ✅ CHECKLIST COMPLETE - Ready for Phase 4 Implementation  
**Next Action:** Review checklist → Approve → Start Session 1 (Foundation)  
**Estimated Completion:** 8-12 hours (spread across multiple sessions)

