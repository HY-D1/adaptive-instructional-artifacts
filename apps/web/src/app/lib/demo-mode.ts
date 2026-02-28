/**
 * Demo Mode Configuration
 * 
 * When deployed to Vercel (or any hosting without localhost Ollama):
 * - LLM features gracefully degrade to SQL-Engage hints
 * - PDF features work with pre-built index
 * - All other features work normally
 */

/**
 * Check if we're running in demo mode (no localhost Ollama available)
 * This is true for Vercel deployments or when explicitly enabled
 */
export function isDemoMode(): boolean {
  // Check for explicit demo mode override
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('demo')) return true;
    
    // Check localStorage for demo setting
    const demoSetting = localStorage.getItem('sql-adapt-demo-mode');
    if (demoSetting === 'true') return true;
  }
  
  // Auto-detect: if we're on HTTPS (production), we're likely in demo mode
  // unless a hosted Ollama URL is configured
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const hasHostedOllama = Boolean(import.meta.env.VITE_OLLAMA_URL);
    
    if (isHttps && !hasHostedOllama) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the demo mode status message for UI display
 */
export function getDemoModeMessage(): string {
  return '🎓 Demo Mode: AI hints use pre-built content. All core features work!';
}

/**
 * Check if LLM should be attempted
 * Returns false in demo mode to avoid unnecessary network errors
 */
export function shouldAttemptLLM(): boolean {
  // In demo mode, skip LLM calls entirely
  if (isDemoMode()) {
    return false;
  }
  
  // Otherwise, try LLM (it has its own fallback handling)
  return true;
}

/**
 * Demo mode welcome message for instructors
 */
export function getInstructorWelcomeMessage(): string {
  return `
## 👋 Welcome to SQL-Adapt Demo

This is a **hosted demo** of the SQL-Adapt learning system.

### What's Working:
- ✅ **32 SQL Practice Problems** - Full curriculum coverage
- ✅ **Adaptive Hint System** - Progressive guidance (L1→L2→L3→Explanation)
- ✅ **SQL-Engage Dataset** - Research-backed hints
- ✅ **Automatic Textbook** - Personal note accumulation
- ✅ **Progress Tracking** - Session persistence
- ✅ **Instructor Dashboard** - Analytics and data export

### Demo Mode Notes:
- 📝 AI-powered explanations use pre-generated content
- 📝 PDF search works with embedded index
- 📝 No local Ollama installation required

**Instructor Passcode:** \`TeachSQL2024\`
`;
}

/**
 * Demo mode student welcome
 */
export function getStudentWelcomeMessage(): string {
  return `
## Welcome to SQL-Adapt! 🎯

Practice SQL with personalized hints and build your own textbook.

**How it works:**
1. Solve SQL problems in the editor
2. Get hints when you're stuck (L1→L2→L3)
3. View explanations to learn
4. Save helpful content to your Textbook

*Demo Mode: All features work without local setup.*
`;
}

/**
 * Version identifier for demo mode
 */
export const DEMO_MODE_VERSION = 'demo-mode-v1.0.0-vercel';
