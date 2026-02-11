import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  BookOpen, 
  Brain, 
  BarChart3, 
  Lightbulb, 
  Database,
  CheckCircle2,
  X
} from 'lucide-react';
import { generateDemoData } from '../data/demo-data';
import { storage } from '../lib/storage';

interface WelcomeModalProps {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [showDemo, setShowDemo] = useState(false);

  const hasData = storage.getAllInteractions().length > 0;

  const handleGenerateDemo = () => {
    generateDemoData();
    setShowDemo(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Welcome to SQL-Adapt
              </h1>
              <p className="text-gray-600">
                Adaptive Instructional Artifacts for SQL Learning Using Interaction Traces
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>

          {showDemo && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="size-5" />
                <span className="font-medium">Demo data generated! Explore the system.</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="p-6 border-2 border-blue-200 bg-blue-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Brain className="size-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg">Adaptive Orchestration</h3>
              </div>
              <p className="text-sm text-gray-700 mb-3">
                The system intelligently decides when to show hints, escalate to explanations,
                or aggregate content into your personalized textbook.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>Analyzes error patterns and retry behavior</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>Progressive hint levels with escalation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>Automatic textbook generation</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-2 border-purple-200 bg-purple-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Lightbulb className="size-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg">HintWise Integration</h3>
              </div>
              <p className="text-sm text-gray-700 mb-3">
                Hints are the lowest-level instructional unit, managed by HintWise
                with controlled escalation policies.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-purple-600 mt-0.5 shrink-0" />
                  <span>Error subtype detection via SQL-Engage</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-purple-600 mt-0.5 shrink-0" />
                  <span>Template-based, constrained LLM generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-purple-600 mt-0.5 shrink-0" />
                  <span>Validated feedback from knowledge base</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-2 border-green-200 bg-green-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-600 rounded-lg">
                  <Database className="size-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg">SQL-Engage Backbone</h3>
              </div>
              <p className="text-sm text-gray-700 mb-3">
                A knowledge graph of SQL concepts with mapped error subtypes and
                validated feedback templates.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Concept nodes with prerequisites</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Error pattern recognition</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Structured concept coverage tracking</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-2 border-orange-200 bg-orange-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-600 rounded-lg">
                  <BarChart3 className="size-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg">Research Dashboard</h3>
              </div>
              <p className="text-sm text-gray-700 mb-3">
                Offline replay and comparison of adaptive strategies for publishable research.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-orange-600 mt-0.5 shrink-0" />
                  <span>Interaction trace analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-orange-600 mt-0.5 shrink-0" />
                  <span>Strategy comparison (hint-only vs adaptive)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-orange-600 mt-0.5 shrink-0" />
                  <span>Export/import for reproducibility</span>
                </li>
              </ul>
            </Card>
          </div>

          <Card className="p-6 bg-gray-50 border-2 mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="size-5" />
              Key Research Components
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <Badge className="mb-2">Adaptive Logic</Badge>
                <p className="text-gray-700">
                  Determines when to stay at hints, escalate to explanations, or aggregate into textbook
                </p>
              </div>
              <div>
                <Badge className="mb-2">Automatic Textbook</Badge>
                <p className="text-gray-700">
                  Dynamically assembles personalized instructional units from interaction patterns
                </p>
              </div>
              <div>
                <Badge className="mb-2">Offline Replay</Badge>
                <p className="text-gray-700">
                  Compare strategies and generate evidence for journal submissions
                </p>
              </div>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4">
            {!hasData && (
              <Button onClick={handleGenerateDemo} className="flex-1" size="lg">
                Generate Demo Data
              </Button>
            )}
            <Button onClick={onClose} variant={hasData ? 'default' : 'outline'} className="flex-1" size="lg">
              {hasData ? 'Continue' : 'Start Fresh'}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            This prototype demonstrates core research components for adaptive SQL instruction.
            All data is stored locally in your browser.
          </p>
        </div>
      </Card>
    </div>
  );
}
