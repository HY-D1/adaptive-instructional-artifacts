import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ResearchDashboard } from '../components/features/research/ResearchDashboard';
import { ArrowLeft, Lock, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useUserRole } from '../hooks/useUserRole';

/**
 * ResearchPage - Research analytics and strategy comparison
 * 
 * **Access Control:**
 * - Instructors: Full access to research dashboard, replay, analytics
 * - Students: Restricted view - shows information about research features
 *   but doesn't provide access to sensitive data or configuration tools
 * 
 * Note: Students can technically navigate to this route, but they'll see
 * an informational page explaining these are instructor research tools.
 */
export function ResearchPage() {
  const navigate = useNavigate();
  const { isInstructor, isStudent } = useUserRole();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(isInstructor ? '/instructor-dashboard' : '/practice')}
            >
              <ArrowLeft className="size-4 mr-2" />
              {isInstructor ? 'Back to Dashboard' : 'Back to Practice'}
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Research Dashboard</h1>
              <p className="text-gray-600 text-sm">
                {isInstructor 
                  ? 'Offline replay and strategy comparison for publishable research'
                  : 'Research tools and analytics overview'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {isInstructor ? (
          /* Instructors see the full research dashboard */
          <ResearchDashboard />
        ) : (
          /* Students see an informational restricted view */
          <div className="max-w-2xl mx-auto">
            <Card className="border-amber-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <Lock className="size-8 text-amber-600" />
                </div>
                <CardTitle className="text-xl">Instructor Research Tools</CardTitle>
                <CardDescription>
                  This area contains research and analytics tools designed for instructors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <GraduationCap className="size-4" />
                    What happens here?
                  </h3>
                  <ul className="text-sm text-gray-600 space-y-2 ml-6 list-disc">
                    <li>Researchers analyze learning patterns across all students</li>
                    <li>Compare effectiveness of different hint strategies</li>
                    <li>Review aggregated error patterns to improve content</li>
                    <li>Export anonymized data for research publications</li>
                  </ul>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Your Learning Data</h3>
                  <p className="text-sm text-blue-700">
                    Your individual practice sessions and progress are private. 
                    Only anonymized, aggregated statistics are used for research 
                    to improve the learning experience for future students.
                  </p>
                </div>

                <div className="flex justify-center pt-2">
                  <Button onClick={() => navigate('/practice')}>
                    <GraduationCap className="size-4 mr-2" />
                    Return to Practice
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
