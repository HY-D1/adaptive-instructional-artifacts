import { Button } from '../components/ui/button';
import { ResearchDashboard } from '../components/features/research/ResearchDashboard';
import { ArrowLeft, Globe } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { isHostedMode, getHostedModeMessage } from '../lib/runtime-config';

/**
 * ResearchPage - Research analytics and strategy comparison
 * 
 * **Access Control:**
 * - Route protected for instructors only via InstructorRoute guard
 * - Instructors have full access to research dashboard, replay, and analytics
 */
export function ResearchPage() {
  const navigate = useNavigate();
  const [hostedMode, setHostedMode] = useState(false);

  useEffect(() => {
    setHostedMode(isHostedMode());
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hosted Mode Banner */}
      {hostedMode && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3 text-amber-800">
              <Globe className="size-5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">Hosted Mode Active</p>
                <p className="text-xs text-amber-700">{getHostedModeMessage()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
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
