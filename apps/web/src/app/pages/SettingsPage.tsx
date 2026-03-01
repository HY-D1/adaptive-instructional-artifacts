import { useState, useEffect, useCallback, useMemo } from 'react';

import {
  Settings,
  FileText,
  Bot,
  FlaskConical,
  RotateCcw,
  Trash2,
  UserCog,
  Target,
  BrainCircuit,
  GitBranch,
} from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Separator } from '../components/ui/separator';
import { PdfUploader } from '../components/PdfUploader';
import { LLMSettingsHelper } from '../components/LLMSettingsHelper';
import { useUserRole } from '../hooks/useUserRole';
import { banditManager, BANDIT_ARM_PROFILES } from '../lib/learner-bandit-manager';
import type { BanditArmId } from '../lib/learner-bandit-manager';
import { assignProfile } from '../lib/escalation-profiles';
import type { AssignmentStrategy } from '../lib/escalation-profiles';
import { storage } from '../lib/storage';
import type { InteractionEvent } from '../types';
import { calculateHDIData, filterOutHDIEvents, formatHDIDetailed } from '../lib/hdi-debug';

// DEV mode check
const isDev = import.meta.env.DEV;

// Profile override options
const PROFILE_OPTIONS = [
  { id: 'auto', label: 'Auto (Bandit Assigned)' },
  { id: 'fast-escalator', label: 'Fast Escalator' },
  { id: 'slow-escalator', label: 'Slow Escalator' },
  { id: 'adaptive-escalator', label: 'Adaptive' },
] as const;

type ProfileOverrideId = (typeof PROFILE_OPTIONS)[number]['id'];

// localStorage keys for debug settings
const DEBUG_KEYS = {
  PROFILE_OVERRIDE: 'sql-adapt-debug-profile',
  ASSIGNMENT_STRATEGY: 'sql-adapt-debug-strategy',
} as const;

export function SettingsPage() {
  const { isInstructor, profile } = useUserRole();
  const learnerId = profile?.id;

  // Week 5 Testing Controls State
  const [profileOverride, setProfileOverride] = useState<ProfileOverrideId>('auto');
  const [assignmentStrategy, setAssignmentStrategy] = useState<AssignmentStrategy>('bandit');
  const [hdiScore, setHdiScore] = useState<number | null>(null);
  const [hdiEventCount, setHdiEventCount] = useState<number>(0);
  const [armStats, setArmStats] = useState<
    Array<{
      armId: BanditArmId;
      profileName: string;
      meanReward: number;
      pullCount: number;
    }>
  >([]);
  const [selectedArm, setSelectedArm] = useState<BanditArmId>('adaptive');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Load initial values from localStorage (DEV mode only)
  useEffect(() => {
    if (!isDev) return;

    const savedProfile = localStorage.getItem(DEBUG_KEYS.PROFILE_OVERRIDE);
    if (savedProfile && PROFILE_OPTIONS.some((p) => p.id === savedProfile)) {
      setProfileOverride(savedProfile as ProfileOverrideId);
    }

    const savedStrategy = localStorage.getItem(DEBUG_KEYS.ASSIGNMENT_STRATEGY);
    if (savedStrategy && ['static', 'diagnostic', 'bandit'].includes(savedStrategy)) {
      setAssignmentStrategy(savedStrategy as AssignmentStrategy);
    }
  }, []);

  // Calculate HDI score and count events - memoized for performance
  const hdiData = useMemo(() => {
    if (!isDev || !learnerId) {
      return { score: null, eventCount: 0, events: [] };
    }

    const interactions = storage.getAllInteractions();
    return calculateHDIData(interactions, learnerId);
  }, [learnerId, refreshKey]);

  // Update state from memoized calculation
  useEffect(() => {
    setHdiScore(hdiData.score);
    setHdiEventCount(hdiData.eventCount);
  }, [hdiData]);

  // Get bandit arm stats - separate from HDI calculation
  useEffect(() => {
    if (!isDev || !learnerId) return;

    // Initialize bandit for learner if not exists (to show all arms)
    banditManager.getBanditForLearner(learnerId);

    const stats = banditManager.getLearnerStats(learnerId);
    setArmStats(stats);
  }, [learnerId, refreshKey]);

  // Profile Override Handlers
  const handleProfileOverrideChange = useCallback((value: ProfileOverrideId) => {
    setProfileOverride(value);
    if (value === 'auto') {
      localStorage.removeItem(DEBUG_KEYS.PROFILE_OVERRIDE);
    } else {
      localStorage.setItem(DEBUG_KEYS.PROFILE_OVERRIDE, value);
    }
  }, []);

  const handleResetProfileOverride = useCallback(() => {
    setProfileOverride('auto');
    localStorage.removeItem(DEBUG_KEYS.PROFILE_OVERRIDE);
  }, []);

  // Assignment Strategy Handler
  const handleStrategyChange = useCallback((value: AssignmentStrategy) => {
    setAssignmentStrategy(value);
    localStorage.setItem(DEBUG_KEYS.ASSIGNMENT_STRATEGY, value);
  }, []);

  // HDI Reset Handler
  const handleClearHdiHistory = useCallback(() => {
    if (!learnerId) return;

    const interactions = storage.getAllInteractions();
    const filteredInteractions = filterOutHDIEvents(interactions, learnerId);

    localStorage.setItem('sql-learning-interactions', JSON.stringify(filteredInteractions));
    setHdiScore(null);
    setHdiEventCount(0);
    setRefreshKey((k) => k + 1);
  }, [learnerId]);

  // Force Arm Selection Handler
  const handleForceArmSelection = useCallback(() => {
    if (!learnerId) return;

    // Reset the bandit for this learner to start fresh with forced arm
    banditManager.resetLearner(learnerId);

    // Get the bandit and manually update the selected arm to influence future selections
    const bandit = banditManager.getBanditForLearner(learnerId);

    // Update the selected arm with a positive reward to increase its probability
    bandit.updateArm(selectedArm, 1.0);

    // Log a debug event
    const debugEvent: InteractionEvent = {
      id: `debug-arm-force-${Date.now()}`,
      learnerId,
      timestamp: Date.now(),
      eventType: 'bandit_updated',
      problemId: 'debug',
      selectedArm,
      policyVersion: 'debug-panel-v1',
    };
    storage.saveInteraction(debugEvent);

    setRefreshKey((k) => k + 1);
  }, [learnerId, selectedArm]);

  // Refresh bandit stats
  const handleRefreshStats = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
        <div
          className={`grid grid-cols-1 ${isInstructor ? 'lg:grid-cols-2' : ''} gap-6 max-w-5xl`}
        >
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
                onUploadComplete={() => {
                  // PDF upload complete - handled by component
                }}
                onError={() => {
                  // PDF upload error - handled by component
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

        {/* Week 5 Testing Controls - DEV Mode Only */}
        {isDev && (
          <Card className="mt-6 p-6 max-w-5xl border-amber-300" data-testid="week5-debug-controls">
            <CardHeader className="px-0 pt-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <FlaskConical className="size-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Week 5 Testing Controls
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Debug controls for adaptive learning research components
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  DEV Mode
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="px-0 pb-0 space-y-6">
              {/* Profile Override Section */}
              <div className="space-y-3" data-testid="profile-override-section">
                <div className="flex items-center gap-2">
                  <UserCog className="size-4 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-900">
                    Profile Override
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={profileOverride}
                    onValueChange={(value) =>
                      handleProfileOverrideChange(value as ProfileOverrideId)
                    }
                    data-testid="profile-override-select"
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFILE_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetProfileOverride}
                    disabled={profileOverride === 'auto'}
                    data-testid="profile-override-reset"
                  >
                    <RotateCcw className="size-4 mr-1" />
                    Reset
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Overrides the bandit-assigned escalation profile for this learner
                </p>
              </div>

              <Separator />

              {/* Assignment Strategy Section */}
              <div className="space-y-3" data-testid="assignment-strategy-section">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-900">
                    Assignment Strategy
                  </h3>
                </div>
                <RadioGroup
                  value={assignmentStrategy}
                  onValueChange={(value) =>
                    handleStrategyChange(value as AssignmentStrategy)
                  }
                  className="flex flex-wrap gap-4"
                  data-testid="assignment-strategy-radio"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="static" id="strategy-static" />
                    <Label htmlFor="strategy-static" className="cursor-pointer">
                      Static
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="diagnostic" id="strategy-diagnostic" />
                    <Label htmlFor="strategy-diagnostic" className="cursor-pointer">
                      Diagnostic
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bandit" id="strategy-bandit" />
                    <Label htmlFor="strategy-bandit" className="cursor-pointer">
                      Bandit
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-gray-500">
                  Determines how escalation profiles are assigned to learners
                </p>
              </div>

              <Separator />

              {/* HDI Reset Section */}
              <div className="space-y-3" data-testid="hdi-section">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="size-4 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-900">
                    HDI (Hint Dependency Index)
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-md">
                    <span className="text-sm text-gray-600">Current Score:</span>
                    <span className="text-sm font-mono font-medium" data-testid="hdi-score">
                      {formatHDIDetailed(hdiScore)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-md">
                    <span className="text-sm text-gray-600">Events:</span>
                    <span className="text-sm font-mono font-medium" data-testid="hdi-event-count">
                      {hdiEventCount}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearHdiHistory}
                    disabled={hdiEventCount === 0}
                    data-testid="hdi-clear-button"
                  >
                    <Trash2 className="size-4 mr-1" />
                    Clear HDI History
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Clears all HDI-related events (hdi_calculated, hdi_trajectory_updated,
                  dependency_intervention_triggered) for the current learner
                </p>
              </div>

              <Separator />

              {/* Bandit Debug Panel */}
              <div className="space-y-3" data-testid="bandit-panel">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-4 text-gray-500" />
                    <h3 className="text-sm font-medium text-gray-900">
                      Bandit Debug Panel
                    </h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRefreshStats} data-testid="bandit-refresh">
                    <RotateCcw className="size-4" />
                  </Button>
                </div>

                {/* Arm Stats Table */}
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm" data-testid="bandit-arm-stats">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Arm
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Profile
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">
                          Mean Reward
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">
                          Pulls
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {armStats.length > 0 ? (
                        armStats.map((stat) => (
                          <tr key={stat.armId} className="hover:bg-gray-50" data-testid={`arm-stat-${stat.armId}`}>
                            <td className="px-3 py-2 font-mono text-xs">
                              {stat.armId}
                            </td>
                            <td className="px-3 py-2">{stat.profileName}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {stat.meanReward.toFixed(3)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {stat.pullCount}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-gray-500 italic"
                            data-testid="bandit-no-data"
                          >
                            No bandit data available. Interact with problems to generate
                            data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Force Arm Selection */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Force arm selection:</span>
                  <Select
                    value={selectedArm}
                    onValueChange={(value) => setSelectedArm(value as BanditArmId)}
                    data-testid="force-arm-select"
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select arm" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(BANDIT_ARM_PROFILES).map((armId) => (
                        <SelectItem key={armId} value={armId}>
                          {BANDIT_ARM_PROFILES[armId as BanditArmId].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleForceArmSelection} data-testid="force-arm-apply">
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Manually select a bandit arm to influence future escalation profile
                  assignments
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <Card className="mt-6 p-6 max-w-5xl">
          <h3 className="font-semibold text-gray-900 mb-2">About These Settings</h3>
          <div className="space-y-2 text-sm text-gray-600">
            {isInstructor && (
              <p>
                <strong>PDF Textbook Upload:</strong> Upload your course textbook or
                SQL reference materials in PDF format. The system will index the
                content and use it to provide personalized hints grounded in your
                course materials.
              </p>
            )}
            <p>
              <strong>LLM Configuration:</strong> Adjust the AI model parameters to
              control how hints are generated. Lower temperature values produce more
              focused and consistent hints, while higher values allow for more
              creative variations.
            </p>
            {isDev && (
              <p>
                <strong>Week 5 Testing Controls:</strong> Debug tools for research
                components including escalation profiles, multi-armed bandit
                algorithms, and Hint Dependency Index tracking. These controls are
                only available in development mode.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
