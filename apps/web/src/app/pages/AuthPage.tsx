/**
 * AuthPage — Login / Signup
 *
 * Two tabs: Sign In and Create Account.
 * Signup requires a role-specific access code:
 * - Student: class code
 * - Instructor: instructor code
 *
 * On success the AuthContext syncs the user into localStorage so the existing
 * role-based routing (which reads storage.getUserProfile()) keeps working.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Database, BookOpen, BarChart3, GraduationCap, Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { cn } from '../components/ui/utils';
import { useAuth } from '../lib/auth-context';
import { AUTH_ENABLED } from '../lib/api/auth-client';
import type { UserRole } from '../types';

type Tab = 'login' | 'signup';

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, signup, isAuthenticated, isLoading, user } = useAuth();

  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole | null>(null);
  const [signupClassCode, setSignupClassCode] = useState('');
  const [signupInstructorCode, setSignupInstructorCode] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate(user.role === 'instructor' ? '/instructor-dashboard' : '/practice', { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (!AUTH_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account system not available</CardTitle>
            <CardDescription>
              Set <code className="bg-gray-100 px-1 rounded">VITE_API_BASE_URL</code> to enable account-based login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
              Back to start
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Login handler --------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const result = await login(loginEmail, loginPassword);
    setLoginLoading(false);
    if (!result.success) {
      setLoginError(result.error ?? 'Login failed');
      return;
    }
    // Navigation handled by the useEffect above once user is set
  };

  // ---- Signup handler -------------------------------------------------------

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupRole) return;
    setSignupError(null);
    setSignupLoading(true);
    const result = await signup({
      name: signupName,
      email: signupEmail,
      password: signupPassword,
      role: signupRole,
      classCode: signupRole === 'student' ? signupClassCode : undefined,
      instructorCode: signupRole === 'instructor' ? signupInstructorCode : undefined,
    });
    setSignupLoading(false);
    if (!result.success) {
      const fieldErrors = result.details
        ? Object.entries(result.details)
            .map(([f, msgs]) => `${f}: ${msgs.join(', ')}`)
            .join(' | ')
        : null;
      setSignupError(fieldErrors ?? result.error ?? 'Signup failed');
      return;
    }
    // Navigation handled by useEffect above
  };

  const isSignupValid =
    signupName.trim().length > 0 &&
    signupEmail.includes('@') &&
    signupPassword.length >= 8 &&
    signupRole !== null &&
    (signupRole === 'student'
      ? signupClassCode.length > 0
      : signupRole === 'instructor'
        ? signupInstructorCode.length > 0
        : false);

  // ---- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-gray-900">SQL-Adapt</h1>
            <p className="text-xs text-gray-500">Learning System</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {tab === 'login'
                ? 'Sign in to continue your progress'
                : 'Track your SQL progress across devices'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  tab === t
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* ---- LOGIN FORM ---- */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {loginError && (
                <p className="text-sm text-red-600 font-medium" role="alert">{loginError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={!loginEmail || !loginPassword || loginLoading}
              >
                {loginLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
              <p className="text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => setTab('signup')}
                >
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* ---- SIGNUP FORM ---- */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="signup-name">Display name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Your name"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="pl-10"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role selection */}
              <div className="space-y-2">
                <Label>I am a...</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSignupRole('student')}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left',
                      signupRole === 'student'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-200'
                    )}
                  >
                    <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-medium text-sm">Student</div>
                      <div className="text-xs text-gray-500">Practice SQL</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole('instructor')}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left',
                      signupRole === 'instructor'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-200'
                    )}
                  >
                    <BarChart3 className="w-5 h-5 text-purple-600 shrink-0" />
                    <div>
                      <div className="font-medium text-sm">Instructor</div>
                      <div className="text-xs text-gray-500">View analytics</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Role-specific access code */}
              {(signupRole === 'student' || signupRole === 'instructor') && (
                <div className="space-y-1">
                  <Label htmlFor="signup-code" className="flex items-center gap-1">
                    <Lock className="w-4 h-4" />
                    {signupRole === 'student' ? 'Class code' : 'Instructor code'}
                  </Label>
                  <Input
                    id="signup-code"
                    type="password"
                    placeholder={signupRole === 'student' ? 'Enter the class code' : 'Enter the instructor code'}
                    value={signupRole === 'student' ? signupClassCode : signupInstructorCode}
                    onChange={(e) => {
                      if (signupRole === 'student') {
                        setSignupClassCode(e.target.value);
                        return;
                      }
                      setSignupInstructorCode(e.target.value);
                    }}
                    required
                  />
                </div>
              )}

              {signupError && (
                <p className="text-sm text-red-600 font-medium" role="alert">{signupError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!isSignupValid || signupLoading}
              >
                {signupLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => setTab('login')}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* Back to demo link */}
          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => navigate('/')}
            >
              Continue without an account (demo mode)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AuthPage;
