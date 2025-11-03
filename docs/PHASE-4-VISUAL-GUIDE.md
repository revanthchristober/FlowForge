# 🎨 Phase 4: Visual Design Guide - Sign In & Sign Up Pages

**Design System:** Material You (Material Design 3)  
**Routes:** `/signin` and `/signup`  
**Status:** Design Reference (NO EDITS YET)

---

## 🎨 Design Preview

### Sign In Page (`/signin`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Gradient Background: Purple → Purple-Gray (#6750A4)]     │
│                                                             │
│                  ┌────────────────────┐                     │
│                  │                    │                     │
│                  │   ⚡ FlowForge     │                     │
│                  │                    │                     │
│                  │  Welcome Back!     │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ 📧 Email     │  │                     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ 🔒 Password  │  │                     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  ☐ Remember me     │                     │
│                  │      Forgot pwd?   │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │   Sign In    │  │ ← Primary Button   │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  ──────OR──────    │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ G  Google    │  │ ← OAuth Button     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  No account?       │                     │
│                  │  Sign Up →         │                     │
│                  │                    │                     │
│                  └────────────────────┘                     │
│                     [Material Card]                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Sign Up Page (`/signup`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Gradient Background: Purple → Purple-Gray]               │
│                                                             │
│                  ┌────────────────────┐                     │
│                  │                    │                     │
│                  │   ⚡ FlowForge     │                     │
│                  │                    │                     │
│                  │ Create Account     │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ 👤 Full Name │  │                     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ 📧 Email     │  │                     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ 🔒 Password  │  │                     │
│                  │  └──────────────┘  │                     │
│                  │  [▓▓▓░░░] Weak     │ ← Strength Bar     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ 🔒 Confirm   │  │                     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  ☑ I agree to      │                     │
│                  │    Terms & Privacy │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ Create Acct  │  │                     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  ──────OR──────    │                     │
│                  │                    │                     │
│                  │  ┌──────────────┐  │                     │
│                  │  │ G  Google    │  │                     │
│                  │  └──────────────┘  │                     │
│                  │                    │                     │
│                  │  Have account?     │                     │
│                  │  Sign In →         │                     │
│                  │                    │                     │
│                  └────────────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Material You Color Palette (From Your App)

```typescript
const colors = {
  // Primary Colors
  primary: "#6750A4",              // Purple (buttons, links)
  primaryContainer: "#EADDFF",     // Light purple (hover states)
  onPrimary: "#FFFFFF",            // White text on primary
  onPrimaryContainer: "#21005D",   // Dark text on container
  
  // Secondary Colors
  secondary: "#625B71",            // Purple-gray (accents)
  secondaryContainer: "#E8DEF8",   // Light purple-gray
  onSecondary: "#FFFFFF",
  onSecondaryContainer: "#1D192B",
  
  // Surface Colors
  surface: "#FEF7FF",              // Almost white (backgrounds)
  surfaceVariant: "#E7E0EC",       // Light gray-purple
  surfaceContainerLow: "#F7F2FA",  // Subtle container
  surfaceContainer: "#F3EDF7",     // Card backgrounds
  surfaceContainerHigh: "#ECE6F0", // Elevated cards
  
  // Text Colors
  onSurface: "#1D1B20",            // Dark text (primary)
  onSurfaceVariant: "#49454F",     // Medium text (secondary)
  
  // Border Colors
  outline: "#79747E",              // Medium gray (borders)
  outlineVariant: "#CAC4D0",       // Light gray (subtle borders)
  
  // Error Colors
  error: "#B3261E",                // Red (error states)
  errorContainer: "#F9DEDC",       // Light red (error backgrounds)
  onErrorContainer: "#410E0B",     // Dark red (error text)
  
  // Message Bubbles (for reference)
  userMessageBg: "#E8DEF8",
  userMessageText: "#1D192B",
  assistantMessageBg: "#FFFFFF",
  assistantMessageText: "#1D1B20",
};
```

---

## ✨ Component Specifications

### 1. Auth Card

```css
Container:
  max-width: 450px
  background: colors.surface (#FEF7FF)
  border-radius: 28px
  padding: 40px
  box-shadow: 0px 4px 8px 3px rgba(0,0,0,0.15) /* elevation level3 */
  
Animation on mount:
  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  duration: 0.3s
  easing: cubic-bezier(0.4, 0, 0.2, 1)
```

### 2. Input Fields

```css
Text Input:
  width: 100%
  height: 56px
  padding: 16px
  border: 1px solid colors.outline (#79747E)
  border-radius: 12px
  font-size: 16px
  background: colors.surface
  transition: border-color 0.2s
  
On Focus:
  border-color: colors.primary (#6750A4)
  outline: none
  
On Error:
  border-color: colors.error (#B3261E)
  
Icon (inside input):
  position: absolute
  left: 16px
  color: colors.onSurfaceVariant
  font-size: 20px
  
  With icon, input padding-left: 48px
```

### 3. Primary Button

```css
Button:
  width: 100%
  height: 48px
  background: colors.primary (#6750A4)
  color: colors.onPrimary (#FFFFFF)
  border: none
  border-radius: 24px /* pill shape */
  font-size: 16px
  font-weight: 600
  cursor: pointer
  box-shadow: 0px 2px 6px 2px rgba(0,0,0,0.15) /* elevation level2 */
  transition: all 0.2s
  
On Hover:
  background: #7D5AAF /* 15% lighter */
  transform: translateY(-2px)
  box-shadow: 0px 4px 8px 3px rgba(0,0,0,0.15) /* elevation level3 */
  
On Active:
  transform: translateY(0)
  
Loading State:
  opacity: 0.7
  cursor: not-allowed
  Show spinner inside button
  
Disabled:
  background: colors.surfaceContainerHigh
  color: colors.outline
  cursor: not-allowed
  box-shadow: none
```

### 4. Google OAuth Button

```css
Button:
  width: 100%
  height: 48px
  background: colors.surface (#FFFFFF)
  color: colors.onSurface
  border: 2px solid colors.outline
  border-radius: 24px
  font-size: 16px
  font-weight: 500
  cursor: pointer
  display: flex
  align-items: center
  justify-content: center
  gap: 12px
  transition: all 0.2s
  
Google Logo:
  width: 20px
  height: 20px
  
On Hover:
  background: colors.surfaceContainerHigh (#ECE6F0)
  border-color: colors.primary
```

### 5. Password Strength Indicator

```css
Container:
  height: 4px
  border-radius: 2px
  background: colors.surfaceVariant
  margin-top: 8px
  overflow: hidden
  
Progress Bar:
  height: 100%
  transition: width 0.3s, background 0.3s
  
Weak (0-33%):
  background: #F44336 /* Red */
  width: 33%
  
Medium (34-66%):
  background: #FF9800 /* Orange */
  width: 66%
  
Strong (67-100%):
  background: #4CAF50 /* Green */
  width: 100%
  
Label:
  font-size: 12px
  color: colors.onSurfaceVariant
  margin-top: 4px
```

### 6. Error Message

```css
Error Text:
  font-size: 12px
  color: colors.error
  margin-top: 4px
  display: flex
  align-items: center
  gap: 4px
  
Icon: ⚠️ or 🚫
  
Animation:
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
  duration: 0.4s
```

### 7. Toast Notification (Existing Component)

```css
Toast:
  position: fixed
  bottom: 24px
  left: 50%
  transform: translateX(-50%)
  min-width: 288px
  max-width: 560px
  padding: 16px 24px
  border-radius: 28px
  display: flex
  align-items: center
  gap: 12px
  box-shadow: 0px 4px 8px 3px rgba(0,0,0,0.15)
  z-index: 10000
  
Success:
  background: colors.primaryContainer
  color: colors.primary
  icon: ✓
  
Error:
  background: colors.errorContainer
  color: colors.error
  icon: ⚠️
  
Animation:
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
  duration: 0.3s
  auto-dismiss: 3000ms
```

---

## 📐 Layout Specifications

### Desktop (> 960px)

```
Viewport: 1920x1080

Background:
  Full viewport gradient
  
Auth Card:
  Position: Centered (vertical & horizontal)
  max-width: 450px
  margin: auto
  
Logo:
  font-size: 32px
  margin-bottom: 8px
  
Heading:
  font-size: 28px
  font-weight: 600
  margin-bottom: 32px
  
Form Fields:
  margin-bottom: 20px
  
Buttons:
  margin-top: 24px
```

### Tablet (600px - 960px)

```
Auth Card:
  max-width: 400px
  padding: 32px
  
Font sizes: Same as desktop
Spacing: Slightly reduced (16px gaps)
```

### Mobile (< 600px)

```
Auth Card:
  width: calc(100vw - 40px)
  max-width: none
  padding: 24px
  margin: 20px
  
Logo:
  font-size: 28px
  
Heading:
  font-size: 24px
  
Input Fields:
  height: 52px /* taller for touch */
  
Buttons:
  height: 52px /* taller for touch */
  
Form Fields:
  margin-bottom: 16px
```

---

## 🎭 Animation Timings

```typescript
const animations = {
  // Entrance
  cardEnter: {
    duration: '0.3s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    keyframe: 'scaleIn'
  },
  
  // Interactions
  buttonHover: {
    duration: '0.2s',
    easing: 'ease-out'
  },
  
  inputFocus: {
    duration: '0.2s',
    easing: 'ease-in-out'
  },
  
  // Feedback
  errorShake: {
    duration: '0.4s',
    easing: 'ease-in-out',
    keyframe: 'shake'
  },
  
  toastSlide: {
    duration: '0.3s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    keyframe: 'slideUp'
  },
  
  // Loading
  spinnerRotate: {
    duration: '1s',
    easing: 'linear',
    iteration: 'infinite'
  }
};
```

---

## 🎯 Interactive States

### Input Field States

```
Default:
  border: 1px solid outline
  background: surface
  
Hover:
  border: 1px solid primary (subtle)
  
Focus:
  border: 2px solid primary
  box-shadow: 0 0 0 4px primaryContainer (glow)
  
Filled:
  background: surfaceContainerLow
  
Error:
  border: 2px solid error
  background: errorContainer (5% opacity)
  
Disabled:
  background: surfaceVariant
  color: outline
  cursor: not-allowed
```

### Button States

```
Default:
  Solid primary color
  elevation: level2
  
Hover:
  Lighter primary (15%)
  elevation: level3
  transform: translateY(-2px)
  
Active/Pressed:
  Darker primary (15%)
  elevation: level1
  transform: translateY(0)
  
Loading:
  opacity: 0.7
  spinner inside
  disabled
  
Disabled:
  background: surfaceContainerHigh
  color: outline
  no shadow
  cursor: not-allowed
```

---

## 📱 Touch Targets (Mobile)

All interactive elements meet minimum touch target size:

```
Minimum: 44x44px (iOS) / 48x48px (Android)

Buttons: 52x52px ✓
Input fields: 52px height ✓
Checkboxes: 48x48px ✓
Links: 44x44px minimum click area ✓
```

---

## ♿ Accessibility Features

### Focus Indicators
```css
:focus {
  outline: 2px solid colors.primary;
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none; /* Only for mouse users */
}

:focus-visible {
  outline: 2px solid colors.primary;
  outline-offset: 2px;
}
```

### ARIA Labels
```html
<!-- Email Input -->
<input
  type="email"
  aria-label="Email address"
  aria-required="true"
  aria-invalid="false"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">
  Please enter a valid email
</span>

<!-- Password Toggle -->
<button
  aria-label="Show password"
  aria-pressed="false"
>
  👁️
</button>
```

### Color Contrast
```
All text meets WCAG AA:
- Body text: 4.5:1 ✓
- Large text: 3:1 ✓
- Buttons: 3:1 ✓

High contrast mode supported:
- Border widths increase
- Colors adjust automatically
```

---

## 🎨 Implementation Notes

### Typography
```typescript
Font Family: 'Roboto, system-ui, -apple-system, sans-serif'

Font Sizes:
- Heading: 28px / 600 weight
- Body: 16px / 400 weight
- Button: 16px / 600 weight
- Caption: 12px / 400 weight
- Error: 12px / 500 weight

Line Heights:
- Heading: 36px (1.3)
- Body: 24px (1.5)
- Button: 24px (1.5)
```

### Spacing System (8px base)
```typescript
const spacing = {
  xs: 4,   // 0.5rem
  sm: 8,   // 1rem
  md: 16,  // 2rem
  lg: 24,  // 3rem
  xl: 32,  // 4rem
  xxl: 40, // 5rem
};
```

### Border Radius System
```typescript
const borderRadius = {
  sm: 8,   // Small elements
  md: 12,  // Input fields
  lg: 16,  // Cards (smaller)
  xl: 24,  // Buttons (pill)
  xxl: 28, // Cards (main)
};
```

---

## 🔄 OAuth Flow Visual

```
User clicks "Sign in with Google"
          ↓
Redirect to Google Consent Screen
          ↓
User approves permissions
          ↓
Redirect to /auth/callback?code=...
          ↓
Exchange code for session
          ↓
Create profile in public.users
          ↓
Redirect to / (main app)
```

---

## 📊 Component Hierarchy

```
SignInPage
├── Container (gradient background)
│   └── AuthCard
│       ├── Logo
│       ├── Heading
│       ├── SignInForm
│       │   ├── EmailInput
│       │   ├── PasswordInput
│       │   ├── RememberCheckbox
│       │   ├── ForgotLink
│       │   └── SignInButton
│       ├── Divider ("OR")
│       ├── GoogleButton
│       └── SignUpLink
│
└── Toast (portal, conditional)

SignUpPage
├── Container
│   └── AuthCard
│       ├── Logo
│       ├── Heading
│       ├── SignUpForm
│       │   ├── NameInput
│       │   ├── EmailInput
│       │   ├── PasswordInput
│       │   ├── PasswordStrength
│       │   ├── ConfirmPasswordInput
│       │   ├── TermsCheckbox
│       │   └── CreateAccountButton
│       ├── Divider ("OR")
│       ├── GoogleButton
│       └── SignInLink
│
└── Toast
```

---

## ✅ Visual QA Checklist

- [ ] All colors match Material You palette
- [ ] Shadows consistent (3 elevation levels)
- [ ] Border radius consistent
- [ ] Spacing follows 8px grid
- [ ] Typography hierarchy clear
- [ ] Buttons meet min height (48px)
- [ ] Touch targets adequate (44px+)
- [ ] Focus states visible
- [ ] Hover states smooth
- [ ] Animations feel natural
- [ ] No layout shift on load
- [ ] Responsive on all screens
- [ ] Matches existing app design

---

**Status:** ✅ DESIGN GUIDE COMPLETE  
**Next:** Review → Approve → Start Implementation  
**Reference:** Use this guide while implementing Phase 4

