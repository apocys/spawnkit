# Skills Setup System — Simple Auth & Configuration

## Vision (Kira's Example)
"Rajouter gog lance juste une page d'autorisation Google et c'est bon. Un message de félicitation ou animation et c'est bon."

## Architecture

### 1. One-Click Setup Flow
```
User clicks "Add Skill" (gog) 
  → OAuth popup window opens
  → User authorizes (Google/GitHub/etc.)
  → Popup closes, success animation
  → Skill ready to use
```

### 2. Common OAuth Patterns
- **Google (gog)**: OAuth 2.0 → Gmail/Calendar/Drive access
- **GitHub (gh)**: OAuth App → Issues/PRs/CI access  
- **1Password (op)**: CLI token setup → vault access
- **WhatsApp (wacli)**: QR code scan → chat access

### 3. UI/UX
- **Before**: Complex terminal commands, multiple steps, error-prone
- **After**: Visual wizard, 1-click auth, instant feedback
- **Success**: Celebration animation + "Ready to use!"

### 4. Technical Implementation
- OAuth popup handling (postMessage communication)
- Token storage (secure keychain/localStorage)
- Skill verification (test API call)
- Status indicators (setup progress, auth status)

## Implementation Plan
1. Create OAuth proxy service (handles redirects)
2. Build setup wizard UI components  
3. Integrate with existing Skill Center (F11)
4. Add celebration animations (Lottie/CSS)
5. Test with gog, gh, op skills

## Target Skills for V1
- **gog** (Google Workspace) — OAuth 2.0 most common
- **github** (gh CLI) — Developer workflows
- **1password** (op CLI) — Security workflows
- **imsg** (iMessage) — Communication workflows

## Success Metrics
- Setup time: 5 min → 30 seconds
- Success rate: 60% → 95%  
- User experience: "Frustrating" → "Magical"