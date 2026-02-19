import { Button } from '../components/ui/button';
import { ResearchDashboard } from '../components/ResearchDashboard';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useUserRole } from '../hooks/useUserRole';

export function ResearchPage() {
  const navigate = useNavigate();
  const { isInstructor } = useUserRole();

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
