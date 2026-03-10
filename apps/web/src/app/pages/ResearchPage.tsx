import { Button } from '../components/ui/button';
import { ResearchDashboard } from '../components/features/research/ResearchDashboard';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

/**
 * ResearchPage - Research analytics and strategy comparison
 * 
 * **Access Control:**
 * - Route protected for instructors only via InstructorRoute guard
 * - Instructors have full access to research dashboard, replay, and analytics
 */
export function ResearchPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/instructor-dashboard')}
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Research Dashboard</h1>
              <p className="text-gray-600 text-sm">
                Offline replay and strategy comparison for publishable research
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <ResearchDashboard />
      </div>
    </div>
  );
}
