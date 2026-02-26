import { Card } from '../components/ui/card';
import { Settings, FileText, Bot } from 'lucide-react';
import { PdfUploader } from '../components/PdfUploader';
import { LLMSettingsHelper } from '../components/LLMSettingsHelper';
import { useUserRole } from '../hooks/useUserRole';

export function SettingsPage() {
  const { isInstructor } = useUserRole();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-xl">
              <Settings className="size-7 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600 text-sm">
                Configure your learning environment and AI preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="container mx-auto px-4 py-6">
        <div className={`grid grid-cols-1 ${isInstructor ? 'lg:grid-cols-2' : ''} gap-6 max-w-5xl`}>
          {/* PDF Upload Section - Instructors only */}
          {isInstructor && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="size-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    PDF Textbook Upload
                  </h2>
                  <p className="text-sm text-gray-500">
                    Upload your SQL textbook for personalized hints
                  </p>
                </div>
              </div>
              <PdfUploader
                onUploadComplete={(result) => {
                  console.log('PDF uploaded:', result);
                }}
                onError={(error) => {
                  console.error('PDF upload error:', error);
                }}
              />
            </Card>
          )}

          {/* LLM Configuration Section */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bot className="size-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  LLM Configuration
                </h2>
                <p className="text-sm text-gray-500">
                  Configure AI model settings for hint generation
                </p>
              </div>
            </div>
            <LLMSettingsHelper />
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-6 p-6 max-w-5xl">
          <h3 className="font-semibold text-gray-900 mb-2">
            About These Settings
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            {isInstructor && (
              <p>
                <strong>PDF Textbook Upload:</strong> Upload your course textbook or SQL reference
                materials in PDF format. The system will index the content and use it to provide
                personalized hints grounded in your course materials.
              </p>
            )}
            <p>
              <strong>LLM Configuration:</strong> Adjust the AI model parameters to control how
              hints are generated. Lower temperature values produce more focused and consistent
              hints, while higher values allow for more creative variations.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
