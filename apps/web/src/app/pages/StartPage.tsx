import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

import { BookOpen, BarChart3, Database, GraduationCap, Lock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { cn } from '../components/ui/utils';
import { storage } from '../lib/storage/storage';
import type { UserRole, UserProfile } from '../types';

/**
 * Instructor passcode configuration
 * - DEV: fallback passcode is allowed for development convenience
 * - Production: VITE_INSTRUCTOR_PASSCODE must be set
 */
const ENV_PASSCODE = import.meta.env.VITE_INSTRUCTOR_PASSCODE;
const IS_DEV = import.meta.env.DEV;
const INSTRUCTOR_PASSCODE = ENV_PASSCODE || (IS_DEV ? 'TeachSQL2024' : '');

// Production validation check
const isProductionPasscodeConfigured = IS_DEV || (ENV_PASSCODE && ENV_PASSCODE.length > 0);

/**
 * StartPage - Entry point for the application
 * 
 * Handles user onboarding:
 * - Username input
 * - Role selection (Student/Instructor)
 * - Passcode verification for instructor access
 * - Profile creation and persistence
 * 
 * Redirects returning users based on their saved profile.
 */
export function StartPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for existing profile on mount and redirect if found
  useEffect(() => {
    // Slight delay to ensure React Router is fully initialized
    const checkProfile = () => {
      try {
        const profile = storage.getUserProfile();
        if (profile) {
          // Redirect based on role
          const targetPath = profile.role === 'instructor' 
            ? '/instructor-dashboard' 
            : '/practice';
          navigate(targetPath, { replace: true });
          return;
        }
      } catch (error) {
        console.error('[StartPage] Failed to check user profile:', error);
      }
      setIsLoading(false);
    };

    // Use requestAnimationFrame to ensure we're in a browser environment
    if (typeof window !== 'undefined') {
      requestAnimationFrame(checkProfile);
    } else {
      setIsLoading(false);
    }
  }, [navigate]);

  // Clear passcode error when role changes
  useEffect(() => {
    setPasscodeError(null);
    if (selectedRole !== 'instructor') {
      setPasscode('');
    }
  }, [selectedRole]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !selectedRole) return;

    // NOTE: This is client-side-only authentication suitable for demo purposes.
    // VITE_INSTRUCTOR_PASSCODE is exposed in the frontend bundle.
    // For production use, implement server-side authentication.
    // Validate passcode for instructor role
    if (selectedRole === 'instructor') {
      if (passcode !== INSTRUCTOR_PASSCODE) {
        setPasscodeError('Incorrect passcode. Please try again.');
        return;
      }
    }

    setIsSubmitting(true);

    const profile: UserProfile = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: username.trim(),
      role: selectedRole,
      createdAt: Date.now(),
    };

    storage.saveUserProfile(profile);

    // Also update last activity for session expiry tracking
    try {
      localStorage.setItem('sql-adapt-last-active', Date.now().toString());
    } catch {
      // Ignore errors
    }

    // Redirect based on role
    if (selectedRole === 'instructor') {
      navigate('/instructor-dashboard');
    } else {
      navigate('/practice');
    }
  };

  const isFormValid = username.trim().length > 0 && selectedRole !== null && 
    (selectedRole !== 'instructor' || passcode.length > 0);

  // Show loading spinner while checking for existing profile
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Show error if production passcode is not configured
  if (!isProductionPasscodeConfigured) {
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

        {/* Main Content - Configuration Error */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-amber-900 mb-2">
                    Instructor Access Not Configured
                  </h2>
                  <p className="text-amber-800 mb-4">
                    This application is running in production mode without a configured instructor passcode.
                  </p>
                  <div className="bg-white rounded p-4 text-sm text-gray-700 space-y-2">
                    <p><strong>To enable instructor access:</strong></p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Set the <code className="bg-gray-100 px-1 rounded">VITE_INSTRUCTOR_PASSCODE</code> environment variable</li>
                      <li>Rebuild and redeploy the application</li>
                    </ol>
                    <p className="mt-3 text-xs text-gray-500">
                      Example: <code className="bg-gray-100 px-1 rounded">VITE_INSTRUCTOR_PASSCODE=YourSecurePasscode123</code>
                    </p>
                  </div>
                  <p className="mt-4 text-xs text-amber-700">
                    Student access is still available without configuration.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Allow student access even without instructor config */}
            <div className="mt-6 text-center">
              <Button onClick={() => navigate('/')} variant="outline">
                Continue as Student
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

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

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Welcome Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              SQL-Adapt Learning System
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Personalized SQL learning with adaptive hints and AI-powered explanations
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base font-medium">
                What should we call you?
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">I am a...</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student Card */}
                <Card
                  className={cn(
                    'cursor-pointer transition-all duration-200 border-2 hover:shadow-md',
                    selectedRole === 'student'
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-transparent hover:border-blue-200'
                  )}
                  onClick={() => setSelectedRole('student')}
                >
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">Student</CardTitle>
                    <CardDescription className="text-sm">
                      Practice SQL problems and get adaptive hints
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        32 practice problems
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        Progressive hints
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        Personal textbook
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Instructor Card */}
                <Card
                  className={cn(
                    'cursor-pointer transition-all duration-200 border-2 hover:shadow-md',
                    selectedRole === 'instructor'
                      ? 'border-purple-500 bg-purple-50/50'
                      : 'border-transparent hover:border-purple-200'
                  )}
                  onClick={() => setSelectedRole('instructor')}
                >
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                      <BarChart3 className="w-6 h-6 text-purple-600" />
                    </div>
                    <CardTitle className="text-lg">Instructor</CardTitle>
                    <CardDescription className="text-sm">
                      Track student progress and analyze learning data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                        Student analytics
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                        Concept coverage reports
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                        Learning traces
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Passcode Input - Only shown for instructor */}
            {selectedRole === 'instructor' && (
              <div className="space-y-2">
                <Label htmlFor="passcode" className="text-base font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Instructor Passcode
                </Label>
                <Input
                  id="passcode"
                  type="password"
                  placeholder="Enter instructor passcode"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setPasscodeError(null);
                  }}
                  className={cn(
                    'h-12 text-lg',
                    passcodeError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                />
                {passcodeError && (
                  <p 
                    className="text-sm text-red-600 font-medium" 
                    role="alert" 
                    aria-live="polite"
                  >
                    {passcodeError}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={!isFormValid || isSubmitting}
              className="w-full h-12 text-lg font-medium"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Get Started
                </>
              )}
            </Button>

            {!isFormValid && (
              <p className="text-center text-sm text-gray-500">
                Please enter your username and select a role to continue
              </p>
            )}
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              Your progress will be saved locally on this device
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default StartPage;
