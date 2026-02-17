import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Brain, 
  BarChart3, 
  Lightbulb, 
  Database,
  CheckCircle2,
  X,
  Sparkles,
  ChevronRight,
  Keyboard
} from 'lucide-react';
import { generateDemoData } from '../data/demo-data';
import { storage } from '../lib/storage';

interface WelcomeModalProps {
  onClose: () => void;
}

const WELCOME_STEPS = [
  {
    id: 'intro',
    title: 'Welcome to SQL-Adapt',
    subtitle: 'Adaptive Instructional Artifacts for SQL Learning Using Interaction Traces',
    icon: Sparkles
  },
  {
    id: 'features',
    title: 'Key Features',
    subtitle: 'Discover what makes SQL-Adapt unique',
    icon: Brain
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    subtitle: 'Speed up your workflow',
    icon: Keyboard
  }
];

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [showDemo, setShowDemo] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const hasData = storage.getAllInteractions().length > 0;

  const handleGenerateDemo = () => {
    generateDemoData();
    setShowDemo(true);
    setTimeout(() => {
      handleClose();
    }, 2000);
  };

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-welcome-disabled', 'true');
    }
    onClose();
  };

  const nextStep = () => {
    if (currentStep < WELCOME_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const StepIcon = WELCOME_STEPS[currentStep].icon;
  const primaryActionClasses =
    'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', duration: 0.5 }}
      >
        <Card
          className="max-w-4xl w-full h-[min(90vh,52rem)] max-h-[90vh] gap-0 overflow-hidden shadow-2xl"
          data-testid="welcome-modal"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Header */}
            <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <motion.div 
                    key={currentStep}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="p-3 bg-blue-600 rounded-xl shadow-lg"
                  >
                    <StepIcon className="size-6 text-white" />
                  </motion.div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {WELCOME_STEPS[currentStep].title}
                    </h1>
                    <p className="text-gray-600 mt-1">
                      {WELCOME_STEPS[currentStep].subtitle}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="shrink-0 text-slate-600 hover:text-slate-900"
                  aria-label="Close welcome dialog"
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 mt-6">
                {WELCOME_STEPS.map((step, idx) => (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentStep 
                        ? 'w-8 bg-blue-600' 
                        : idx < currentStep 
                          ? 'w-2 bg-blue-400' 
                          : 'w-2 bg-gray-300'
                    }`}
                    aria-label={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6" data-testid="welcome-modal-content">
              <AnimatePresence mode="wait">
                {showDemo && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="size-5" />
                      <span className="font-medium">Demo data generated! Explore the system.</span>
                    </div>
                  </motion.div>
                )}

                {currentStep === 0 && (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl mb-6">
                        <Database className="size-12 text-white" />
                      </div>
                      <h2 className="text-3xl font-bold mb-3">Master SQL Through Practice</h2>
                      <p className="text-lg text-gray-600 max-w-lg mx-auto">
                        SQL-Adapt uses adaptive learning technology to personalize your SQL education 
                        based on your interaction patterns and learning progress.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { icon: Brain, label: 'Adaptive Learning', desc: 'Personalized hints' },
                        { icon: BookOpen, label: 'Smart Textbook', desc: 'Auto-generated notes' },
                        { icon: BarChart3, label: 'Track Progress', desc: 'Visual analytics' }
                      ].map((item, idx) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="text-center p-4 bg-gray-50 rounded-xl"
                        >
                          <item.icon className="size-8 mx-auto mb-2 text-blue-600" />
                          <p className="font-medium text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {currentStep === 1 && (
                  <motion.div
                    key="features"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <Card className="p-5 border-2 border-blue-200 bg-blue-50/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                          <Brain className="size-5 text-white" />
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

                    <Card className="p-5 border-2 border-purple-200 bg-purple-50/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-600 rounded-lg">
                          <Lightbulb className="size-5 text-white" />
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

                    <Card className="p-5 border-2 border-green-200 bg-green-50/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-600 rounded-lg">
                          <Database className="size-5 text-white" />
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

                    <Card className="p-5 border-2 border-orange-200 bg-orange-50/50 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-orange-600 rounded-lg">
                          <BarChart3 className="size-5 text-white" />
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
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="shortcuts"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="max-w-lg mx-auto"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <kbd className="px-3 py-1.5 bg-white border rounded-md font-mono text-sm shadow-sm">
                            Ctrl
                          </kbd>
                          <span>+</span>
                          <kbd className="px-3 py-1.5 bg-white border rounded-md font-mono text-sm shadow-sm">
                            Enter
                          </kbd>
                        </div>
                        <span className="text-gray-700">Run SQL query</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <kbd className="px-3 py-1.5 bg-white border rounded-md font-mono text-sm shadow-sm">
                            Esc
                          </kbd>
                        </div>
                        <span className="text-gray-700">Close modals</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <kbd className="px-3 py-1.5 bg-white border rounded-md font-mono text-sm shadow-sm">
                            ?
                          </kbd>
                        </div>
                        <span className="text-gray-700">Show this help</span>
                      </div>
                    </div>

                    <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Tip:</strong> You can always access this help dialog by clicking 
                        the Help button in the top navigation bar.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50" data-testid="welcome-modal-footer">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="dont-show"
                      checked={dontShowAgain}
                      onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
                    />
                    <Label htmlFor="dont-show" className="text-sm text-gray-600 cursor-pointer">
                      Don&apos;t show again
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                      <Button variant="ghost" size="sm" onClick={prevStep}>
                        Back
                      </Button>
                    )}
                    {currentStep < WELCOME_STEPS.length - 1 ? (
                      <Button
                        onClick={nextStep}
                        size="sm"
                        className={primaryActionClasses}
                        data-testid="welcome-next-button"
                      >
                        Next
                        <ChevronRight className="ml-1 size-4 shrink-0 stroke-[2.5]" />
                      </Button>
                    ) : (
                      <Button onClick={handleClose} size="sm" className={primaryActionClasses}>
                        Get Started
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {!hasData && (
                    <Button onClick={handleGenerateDemo} variant="outline" size="sm">
                      <Sparkles className="size-4 mr-2" />
                      Generate Demo Data
                    </Button>
                  )}
                  <Button
                    onClick={handleClose}
                    variant={hasData ? 'default' : 'outline'}
                    size="sm"
                    className={hasData ? primaryActionClasses : undefined}
                  >
                    {hasData ? 'Continue' : 'Start Fresh'}
                  </Button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  This prototype demonstrates core research components for adaptive SQL instruction.
                  All data is stored locally in your browser.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
