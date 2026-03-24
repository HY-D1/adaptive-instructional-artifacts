import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router';

import {
  BarChart3,
  BookOpen,
  Users,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Lightbulb,
  Target,
  Activity,
  ChevronRight,
  FileText,
  Eye,
  Play,
  X,
  Database,
  RotateCcw
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../components/ui/dialog';
import { storage, broadcastSync, setDebugProfileWithSync, setDebugStrategyWithSync } from '../lib/storage';
import { seedDemoDataset, resetDemoDataset, hasDemoData } from '../lib/demo/demo-seed';
import { useUserRole } from '../hooks/useUserRole';
import { useAllLearnerProfiles } from '../hooks/useLearnerProfile';
import learnerProfileClient from '../lib/api/learner-profile-client';
import type { LearnerProfile, InteractionEvent } from '../types';

// Helper function to safely format dates
function formatLastActive(timestamp: number | undefined): string {
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
    return 'Never';
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return 'Never';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Demo data - only used when no real student data exists
const DEMO_MODE = import.meta.env.DEV; // Only show demo data in development

const DEMO_STUDENTS = [
  { id: 'demo-1', name: 'Alice Chen (Demo)', email: 'alice.chen@school.edu', lastActive: Date.now() - 3600000 },
  { id: 'demo-2', name: 'Bob Martinez (Demo)', email: 'bob.m@school.edu', lastActive: Date.now() - 7200000 },
  { id: 'demo-3', name: 'Carol Williams (Demo)', email: 'carol.w@school.edu', lastActive: Date.now() - 1800000 },
];

const DEMO_STATS = {
  interactions: 127,
  errors: [
    { type: 'syntax-error', count: 12 },
    { type: 'missing-join-condition', count: 8 },
    { type: 'aggregate-misuse', count: 6 },
    { type: 'subquery-error', count: 5 },
  ],
  conceptMastery: [
    { concept: 'SELECT Basics', masteryRate: 78 },
    { concept: 'WHERE Clause', masteryRate: 65 },
    { concept: 'JOIN Operations', masteryRate: 42 },
    { concept: 'Aggregations', masteryRate: 35 },
    { concept: 'Subqueries', masteryRate: 28 },
  ]
};

// Demo adaptive data for development
const DEMO_ADAPTIVE_DATA = {
  profiles: [
    { learnerId: 'demo-1', profile: 'adaptive', strategy: 'bandit', hdi: 0.65 },
    { learnerId: 'demo-2', profile: 'fast', strategy: 'diagnostic', hdi: 0.82 },
    { learnerId: 'demo-3', profile: 'slow', strategy: 'static', hdi: 0.45 },
  ],
  banditPulls: { fast: 45, slow: 32, adaptive: 78 }
};

// Mock class statistics
interface ClassStats {
  totalStudents: number;
  activeToday: number;
  avgProgress: number;
  totalInteractions: number;
  commonErrors: Array<{ type: string; count: number; percentage: number }>;
  conceptMastery: Array<{ concept: string; masteryRate: number }>;
}

// Adaptive learning data interfaces
interface StudentAdaptiveProfile {
  learnerId: string;
  name: string;
  profile: 'fast' | 'slow' | 'adaptive';
  strategy: 'static' | 'diagnostic' | 'bandit';
  hdi: number;
  hdiTrend: 'up' | 'down' | 'stable';
  lastUpdated: number;
}

interface AdaptiveStats {
  averageHDI: number;
  profileDistribution: { fast: number; slow: number; adaptive: number };
  banditPulls: { fast: number; slow: number; adaptive: number };
  highDependencyStudents: StudentAdaptiveProfile[];
  degradingStudents: StudentAdaptiveProfile[];
}

/**
 * InstructorDashboard - Overview dashboard for instructors
 * 
 * Displays:
 * - Class statistics (student count, activity, progress)
 * - Concept mastery rates across the class
 * - Common error patterns
 * - Recent student activity
 * - Adaptive Learning Insights (Week 5)
 * 
 * Includes mock/demo data for MVP - real backend integration pending.
 * Redirects students to home page (instructor-only access).
 */
export function InstructorDashboard() {
  const navigate = useNavigate();
  const { isStudent, isLoading: isRoleLoading } = useUserRole();
  
  // Use backend profiles with automatic synchronization
  const {
    profiles: backendProfiles,
    isLoading: isProfilesLoading,
    refresh: refreshProfiles,
    totalInteractionCount: backendTotalInteractions,
    averageConceptCoverage: backendAvgCoverage,
  } = useAllLearnerProfiles();
  
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [demoDataExists, setDemoDataExists] = useState(false);
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);

  // Check backend availability
  useEffect(() => {
    const checkBackend = async () => {
      const available = await learnerProfileClient.checkBackendHealth();
      setIsBackendAvailable(available);
    };
    checkBackend();
  }, []);

  // Check for demo data on mount
  useEffect(() => {
    setDemoDataExists(hasDemoData());
  }, [profiles, interactions]);

  // Redirect students away from instructor pages
  useEffect(() => {
    if (!isRoleLoading && isStudent) {
      navigate('/', { replace: true });
    }
  }, [isStudent, isRoleLoading, navigate]);

  // Load data from backend or fallback to local storage
  useEffect(() => {
    const loadData = async () => {
      setIsDataLoading(true);

      if (isBackendAvailable) {
        await storage.hydrateInstructorDashboard();
      }

      const allProfiles = storage.getAllProfiles().map(p => storage.getProfile(p.id)).filter(Boolean) as LearnerProfile[];
      const allInteractions = storage.getAllInteractions();
      setProfiles(backendProfiles.length > 0 ? backendProfiles : allProfiles);
      setInteractions(allInteractions);

      setIsDataLoading(false);
    };
    
    void loadData();
  }, [isBackendAvailable, backendProfiles]);

  // Toast auto-hide
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Determine if we should show demo data
  const hasRealData = profiles.length > 0 || interactions.length > 0;
  const showDemoData = DEMO_MODE && !hasRealData;

  // Normalize profiles once at load time - ensures consistent data quality
  // Backend profiles are already normalized, local profiles need normalization
  const normalizedProfiles = useMemo(() => {
    return profiles.map(p => ({
      ...p,
      name: p.name || p.id,
      createdAt: p.createdAt || Date.now(),
      lastActive: p.lastActive || p.createdAt || Date.now(),
      // Ensure conceptsCovered is a Set (backend returns array)
      conceptsCovered: p.conceptsCovered instanceof Set ? p.conceptsCovered : new Set(p.conceptsCovered || []),
      // Ensure Maps are properly initialized
      conceptCoverageEvidence: p.conceptCoverageEvidence instanceof Map 
        ? p.conceptCoverageEvidence 
        : new Map(Object.entries(p.conceptCoverageEvidence || {})),
      errorHistory: p.errorHistory instanceof Map 
        ? p.errorHistory 
        : new Map(Object.entries(p.errorHistory || {})),
    }));
  }, [profiles]);

  // Calculate class statistics
  const classStats: ClassStats = useMemo(() => {
    // Use normalized profiles if available, otherwise use demo students in dev mode
    const studentList = hasRealData ? normalizedProfiles : (showDemoData ? DEMO_STUDENTS : []);
    const totalStudents = studentList.length;
    const activeToday = studentList.filter(s => Date.now() - (s.lastActive || 0) < 86400000).length;
    
    // Calculate average progress based on concept coverage
    // Use backend average if available, otherwise calculate from profiles
    const avgProgress = isBackendAvailable && backendAvgCoverage > 0
      ? Math.round((backendAvgCoverage / 6) * 100)
      : normalizedProfiles.length > 0
        ? Math.round(normalizedProfiles.reduce((sum, p) => sum + (p.conceptsCovered?.size || 0), 0) / normalizedProfiles.length / 6 * 100)
        : (showDemoData ? 45 : 0);

    // Use real interactions or backend total, add demo interactions in dev mode
    const totalInteractions = isBackendAvailable && backendTotalInteractions > 0
      ? backendTotalInteractions
      : interactions.length + (showDemoData ? DEMO_STATS.interactions : 0);

    // Analyze common errors from real data
    const errorCounts = interactions
      .filter(i => i.eventType === 'error' && i.errorSubtypeId)
      .reduce((acc, i) => {
        acc[i.errorSubtypeId!] = (acc[i.errorSubtypeId!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Add demo error patterns only in dev mode when no real data
    if (showDemoData) {
      DEMO_STATS.errors.forEach(e => {
        errorCounts[e.type] = (errorCounts[e.type] || 0) + e.count;
      });
    }

    const totalErrors = Object.values(errorCounts).reduce((a, b) => a + b, 0) || 1;
    const commonErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({
        type: type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count,
        percentage: Math.round((count / totalErrors) * 100)
      }));

    // Concept mastery rates - use demo only in dev mode when no real data
    const conceptMastery = hasRealData 
      ? [] // Would calculate from real data
      : (showDemoData ? DEMO_STATS.conceptMastery : []);

    return {
      totalStudents,
      activeToday,
      avgProgress: Math.min(avgProgress || (showDemoData ? 45 : 0), 100),
      totalInteractions,
      commonErrors: commonErrors.length > 0 ? commonErrors : [],
      conceptMastery
    };
  }, [normalizedProfiles, interactions, hasRealData, showDemoData]);

  // Memoized helper to calculate student adaptive profiles
  const studentAdaptiveProfiles = useMemo(() => {
    // Get latest condition/profile assignment per learner.
    // condition_assigned is canonical; profile_assigned is kept for legacy traces.
    const latestProfiles = interactions
      .filter(e => e.eventType === 'condition_assigned' || e.eventType === 'profile_assigned')
      .reduce((acc, e) => {
        // condition_assigned always wins over a profile_assigned for the same learner
        if (!acc[e.learnerId] || e.eventType === 'condition_assigned' || e.timestamp > acc[e.learnerId].timestamp) {
          acc[e.learnerId] = e;
        }
        return acc;
      }, {} as Record<string, InteractionEvent>);

    // Get latest HDI calculation per learner
    const latestHDI = interactions
      .filter(e => e.eventType === 'hdi_calculated')
      .reduce((acc, e) => {
        acc[e.learnerId] = e;
        return acc;
      }, {} as Record<string, InteractionEvent>);

    // Get HDI history for trend calculation
    const hdiHistory = interactions
      .filter(e => e.eventType === 'hdi_calculated')
      .reduce((acc, e) => {
        if (!acc[e.learnerId]) acc[e.learnerId] = [];
        acc[e.learnerId].push(e);
        return acc;
      }, {} as Record<string, InteractionEvent[]>);

    // Build student profiles
    const studentProfiles: StudentAdaptiveProfile[] = [];
    const allLearnerIds = new Set([
      ...Object.keys(latestProfiles),
      ...Object.keys(latestHDI),  // Also include learners with HDI events (critical for adaptive stats)
      ...normalizedProfiles.map(p => p.id)
    ]);

    // Use demo data in dev mode if no real data
    const useDemo = showDemoData && allLearnerIds.size === 0;

    if (useDemo) {
      DEMO_ADAPTIVE_DATA.profiles.forEach(demo => {
        const demoStudent = DEMO_STUDENTS.find(s => s.id === demo.learnerId);
        studentProfiles.push({
          learnerId: demo.learnerId,
          name: demoStudent?.name || demo.learnerId,
          profile: demo.profile as 'fast' | 'slow' | 'adaptive',
          strategy: demo.strategy as 'static' | 'diagnostic' | 'bandit',
          hdi: demo.hdi,
          // HDI > 0.6 = degrading (high dependency) -> trend = 'down'
          hdiTrend: demo.hdi > 0.6 ? 'down' : 'stable',
          lastUpdated: Date.now()
        });
      });
    } else {
      allLearnerIds.forEach(learnerId => {
        const profile = normalizedProfiles.find(p => p.id === learnerId);
        const profileEvent = latestProfiles[learnerId];
        const hdiEvent = latestHDI[learnerId];
        const history = hdiHistory[learnerId] || [];

        // Calculate trend from history
        // Note: HDI = Hint Dependency Index
        // - Higher HDI = MORE dependent on hints (WORSE performance)
        // - Lower HDI = LESS dependent on hints (BETTER performance)
        // So: HDI increasing = student degrading (trend = 'down')
        //     HDI decreasing = student improving (trend = 'up')
        let hdiTrend: 'up' | 'down' | 'stable' = 'stable';
        if (history.length >= 2) {
          const sorted = history.sort((a, b) => a.timestamp - b.timestamp);
          const recent = sorted.slice(-3);
          const values = recent.map(e => (e.payload?.hdi as number) || 0);
          if (values.length >= 2) {
            const first = values[0];
            const last = values[values.length - 1];
            // HDI going UP means student is getting WORSE (degrading)
            if (last > first + 0.05) hdiTrend = 'down';
            // HDI going DOWN means student is getting BETTER (improving)
            else if (last < first - 0.05) hdiTrend = 'up';
          }
        }

        studentProfiles.push({
          learnerId,
          name: profile?.name ?? learnerId,  // already normalized
          profile: (profileEvent?.payload?.profile as 'fast' | 'slow' | 'adaptive') || 'adaptive',
          strategy: (profileEvent?.payload?.strategy as 'static' | 'diagnostic' | 'bandit') || 'static',
          hdi: ((hdiEvent?.payload?.hdi as number) ?? (hdiEvent?.hdi as number)) || 0.5,
          hdiTrend,
          lastUpdated: hdiEvent?.timestamp || Date.now()
        });
      });
    }

    return { studentProfiles, useDemo };
  }, [interactions, normalizedProfiles, showDemoData]);

  // Calculate adaptive learning statistics from profiles
  const adaptiveStats: AdaptiveStats = useMemo(() => {
    const { studentProfiles, useDemo } = studentAdaptiveProfiles;
    
    // Calculate statistics
    const totalStudents = studentProfiles.length || 1;
    const averageHDI = studentProfiles.reduce((sum, s) => sum + s.hdi, 0) / totalStudents;

    const profileDistribution = {
      fast: Math.round((studentProfiles.filter(s => s.profile === 'fast').length / totalStudents) * 100),
      slow: Math.round((studentProfiles.filter(s => s.profile === 'slow').length / totalStudents) * 100),
      adaptive: Math.round((studentProfiles.filter(s => s.profile === 'adaptive').length / totalStudents) * 100)
    };

    // Get bandit pulls from events
    const banditEvents = interactions.filter(e => e.eventType === 'bandit_arm_selected');
    const banditPulls = useDemo 
      ? DEMO_ADAPTIVE_DATA.banditPulls
      : {
          fast: banditEvents.filter(e => e.payload?.arm === 'fast').length,
          slow: banditEvents.filter(e => e.payload?.arm === 'slow').length,
          adaptive: banditEvents.filter(e => e.payload?.arm === 'adaptive').length
        };

    // Identify students needing intervention
    // High dependency: HDI >= 0.8 (heavily dependent on hints)
    const highDependencyStudents = studentProfiles.filter(s => s.hdi >= 0.8);
    // Degrading: HDI trend is 'down' (getting worse) AND current HDI > 0.5 (moderately dependent)
    const degradingStudents = studentProfiles.filter(s => s.hdiTrend === 'down' && s.hdi > 0.5);

    return {
      averageHDI,
      profileDistribution,
      banditPulls,
      highDependencyStudents,
      degradingStudents
    };
  }, [studentAdaptiveProfiles, interactions]);

  // Handle intervention trigger
  const [interveningStudents, setInterveningStudents] = useState<Set<string>>(new Set());
  
  // Student Preview state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<'fast' | 'slow' | 'adaptive' | 'explanation-first'>('adaptive');
  const [previewProblem, setPreviewProblem] = useState<string>('problem-1');

  
  const handleTriggerIntervention = async (student: StudentAdaptiveProfile) => {
    // Set loading state for this student
    setInterveningStudents(prev => new Set(prev).add(student.learnerId));
    
    // Log intervention event with correct event type
    const interventionEvent: InteractionEvent = {
      id: `intervention-${Date.now()}`,
      learnerId: student.learnerId,
      timestamp: Date.now(),
      eventType: 'dependency_intervention_triggered',
      problemId: 'instructor-dashboard',
      payload: {
        hdi: student.hdi,
        hdiLevel: student.hdi > 0.8 ? 'high' : 'medium',
        reason: student.hdi > 0.8 ? 'high_dependency' : 'degrading_trend',
        interventionType: student.hdi > 0.8 ? 'forced_independent' : 'reflective_prompt',
        profile: student.profile
      }
    };

    // Save to storage
    storage.saveInteraction(interventionEvent);
    
    // Simulate brief delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Remove from loading state
    setInterveningStudents(prev => {
      const next = new Set(prev);
      next.delete(student.learnerId);
      return next;
    });

    // Show toast
    setToastMessage(`Intervention triggered for ${student.name}`);
  };

  // Calculate quick stats
  const quickStats = useMemo(() => [
    { 
      label: 'Total Students', 
      value: classStats.totalStudents, 
      icon: Users, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    { 
      label: 'Active Today', 
      value: classStats.activeToday, 
      icon: Activity, 
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    { 
      label: 'Avg Progress', 
      value: `${classStats.avgProgress}%`, 
      icon: TrendingUp, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    { 
      label: 'Total Interactions', 
      value: classStats.totalInteractions, 
      icon: Target, 
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
  ], [classStats]);

  // Get profile badge color
  const getProfileBadgeColor = (profile: string) => {
    switch (profile) {
      case 'fast': return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'slow': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'adaptive': return 'bg-green-100 text-green-800 hover:bg-green-100';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get strategy badge variant
  const getStrategyBadgeVariant = (strategy: string) => {
    switch (strategy) {
      case 'bandit': return 'default';
      case 'diagnostic': return 'secondary';
      case 'static': return 'outline';
      default: return 'outline';
    }
  };

  const handleSeedDemo = () => {
    const result = seedDemoDataset();
    if (result.success) {
      setToastMessage(`Demo data seeded: ${result.learners} learners, ${result.interactions} events, ${result.units} units`);
      // Reload data
      const allProfiles = storage.getAllProfiles().map(p => storage.getProfile(p.id)).filter(Boolean) as LearnerProfile[];
      const allInteractions = storage.getAllInteractions();
      setProfiles(allProfiles);
      setInteractions(allInteractions);
      setDemoDataExists(true);
    } else {
      setToastMessage(`Failed to seed demo data: ${result.error}`);
    }
  };

  const handleResetDemo = () => {
    if (confirm('Are you sure you want to reset demo data? This will remove all demo learners and their data.')) {
      const result = resetDemoDataset();
      if (result.success) {
        setToastMessage('Demo data has been reset');
        setProfiles([]);
        setInteractions([]);
        setDemoDataExists(false);
      } else {
        setToastMessage(`Failed to reset data: ${result.error}`);
      }
    }
  };

  if (isRoleLoading || isDataLoading || isProfilesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="size-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Instructor Dashboard</h1>
              </div>
              <p className="text-gray-600">Overview of class progress and learning analytics</p>
            </div>
            <div className="flex items-center gap-3">
              {showDemoData && (
                <Badge variant="secondary" className="text-sm px-3 py-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Demo Mode
                </Badge>
              )}
              {isBackendAvailable && (
                <Badge variant="outline" className="text-sm px-3 py-1 bg-green-50 text-green-700 border-green-200">
                  Backend Connected
                </Badge>
              )}
              <Badge variant="outline" className="text-sm px-3 py-1">
                <Users className="size-3 mr-1" />
                {classStats.totalStudents} Students
              </Badge>
            </div>
            {DEMO_MODE && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedDemo}
                  disabled={demoDataExists}
                  className="gap-2"
                  data-testid="seed-demo-button"
                >
                  <Database className="w-4 h-4" />
                  Seed Demo Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetDemo}
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid="reset-demo-button"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Demo Data
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStats.map((stat) => (
            <Card key={stat.label} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`size-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/research')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-indigo-50">
                    <BarChart3 className="size-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Research & Analytics</h3>
                    <p className="text-sm text-gray-600 mt-1">Deep dive into learning patterns and strategy comparison</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/textbook')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-emerald-50">
                    <BookOpen className="size-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">My Textbook</h3>
                    <p className="text-sm text-gray-600 mt-1">View your accumulated notes and explanations</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Preview Card */}
        <Card 
          className="border-blue-200 bg-gradient-to-r from-blue-50 to-white"
          onClick={(e) => {
            // Prevent any card-level click from refreshing page
            if ((e.target as HTMLElement).tagName !== 'BUTTON') {
              e.preventDefault();
            }
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Eye className="size-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-blue-900">Student Preview Mode</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Experience the platform as a student without logging out. Test different escalation profiles and see what students see.
                  </p>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    // Prevent any default behavior
                    e.preventDefault();
                    e.stopPropagation();
                    
                    setShowPreviewModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  data-testid="launch-preview-button"
                >
                  <Play className="size-4" />
                  Launch Preview
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Storage Info Card */}
        <Card className={isBackendAvailable ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${isBackendAvailable ? "bg-green-100" : "bg-amber-100"}`}>
                <AlertCircle className={`size-6 ${isBackendAvailable ? "text-green-600" : "text-amber-600"}`} />
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold text-lg ${isBackendAvailable ? "text-green-900" : "text-amber-900"}`}>
                  {isBackendAvailable ? "Backend Storage Active" : "About Data Storage"}
                </h3>
                <p className={`text-sm mt-1 ${isBackendAvailable ? "text-green-800" : "text-amber-800"}`}>
                  {isBackendAvailable 
                    ? "Learner profiles are being persisted to the backend database. This enables class-wide analytics across all devices and sessions. Data is automatically synchronized and can be reconstructed from event history."
                    : "All learning data is stored locally in your browser. Student progress, textbooks, and interactions are saved per-browser and cannot be accessed across different devices or browsers. For a full classroom management system with cloud storage, a backend integration would be required."
                  }
                </p>
                <div className={`mt-3 flex gap-4 text-xs ${isBackendAvailable ? "text-green-700" : "text-amber-700"}`}>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Demo Mode Available
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${isBackendAvailable ? "bg-green-500" : "bg-amber-500"}`}></span>
                    {isBackendAvailable ? "Backend Storage" : "Local Storage Only"}
                  </span>
                  {isBackendAvailable && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {backendProfiles.length} Profile{backendProfiles.length !== 1 ? 's' : ''} Synced
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adaptive Learning Insights Section (Week 5) */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Activity className="size-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Adaptive Learning Insights</h2>
          </div>

          {/* Class Adaptive Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Average HDI */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-600">Average HDI</p>
                    <span className="text-2xl font-bold">{(adaptiveStats.averageHDI * 100).toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={adaptiveStats.averageHDI * 100} 
                    className="h-3"
                  />
                  <p className="text-xs text-gray-500">
                    Hint Dependency Index across all students
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Profile Distribution */}
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600 mb-4">Profile Distribution</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Fast</Badge>
                    <span className="font-semibold">{adaptiveStats.profileDistribution.fast}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Slow</Badge>
                    <span className="font-semibold">{adaptiveStats.profileDistribution.slow}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Adaptive</Badge>
                    <span className="font-semibold">{adaptiveStats.profileDistribution.adaptive}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bandit Exploration */}
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600 mb-4">Bandit Exploration</p>
                <div className="space-y-3">
                  {(['fast', 'slow', 'adaptive'] as const).map(arm => {
                    const total = adaptiveStats.banditPulls.fast + adaptiveStats.banditPulls.slow + adaptiveStats.banditPulls.adaptive || 1;
                    const percentage = Math.round((adaptiveStats.banditPulls[arm] / total) * 100);
                    return (
                      <div key={arm} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{arm}</span>
                          <span className="font-medium">{adaptiveStats.banditPulls[arm]} pulls ({percentage}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dependency Alerts Panel */}
          {(adaptiveStats.highDependencyStudents.length > 0 || adaptiveStats.degradingStudents.length > 0) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="size-5 text-red-500" />
                Dependency Alerts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adaptiveStats.highDependencyStudents.map(student => (
                  <Alert key={student.learnerId} variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="size-4" />
                    <div className="flex-1">
                      <AlertTitle className="flex items-center gap-2">
                        High Dependency Alert: {student.name}
                      </AlertTitle>
                      <AlertDescription className="mt-1">
                        HDI Score: {(student.hdi * 100).toFixed(0)}% - Student relies heavily on hints
                      </AlertDescription>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-300 hover:bg-red-100"
                      onClick={() => handleTriggerIntervention(student)}
                      disabled={interveningStudents.has(student.learnerId)}
                    >
                      {interveningStudents.has(student.learnerId) ? 'Triggering...' : 'Trigger Intervention'}
                    </Button>
                  </Alert>
                ))}
                {adaptiveStats.degradingStudents.map(student => (
                  <Alert key={student.learnerId} className="border-yellow-200 bg-yellow-50">
                    <TrendingDown className="size-4 text-yellow-600" />
                    <div className="flex-1">
                      <AlertTitle className="flex items-center gap-2 text-yellow-800">
                        Degrading Trend: {student.name}
                      </AlertTitle>
                      <AlertDescription className="mt-1 text-yellow-700">
                        HDI Score: {(student.hdi * 100).toFixed(0)}% with declining trend
                      </AlertDescription>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-yellow-300 hover:bg-yellow-100"
                      onClick={() => handleTriggerIntervention(student)}
                      disabled={interveningStudents.has(student.learnerId)}
                    >
                      {interveningStudents.has(student.learnerId) ? 'Triggering...' : 'Trigger Intervention'}
                    </Button>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Student Profile List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Student Adaptive Profiles
              </CardTitle>
              <CardDescription>
                Escalation profiles, assignment strategies, and HDI scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>HDI Score</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentAdaptiveProfiles.studentProfiles.map(student => (
                    <TableRow key={student.learnerId}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>
                        <Badge className={getProfileBadgeColor(student.profile)}>
                          {student.profile.charAt(0).toUpperCase() + student.profile.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStrategyBadgeVariant(student.strategy)}>
                          {student.strategy}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.hdi * 100} className="w-20 h-2" />
                          <span className="text-sm">{(student.hdi * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.hdiTrend === 'up' && <TrendingUp className="size-5 text-green-500" />}
                        {student.hdiTrend === 'down' && <TrendingDown className="size-5 text-red-500" />}
                        {student.hdiTrend === 'stable' && <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <select 
                          className="text-sm border rounded px-2 py-1 bg-white"
                          onChange={(e) => {
                            if (e.target.value) {
                              const overrideEvent: InteractionEvent = {
                                id: `override-${Date.now()}`,
                                learnerId: student.learnerId,
                                timestamp: Date.now(),
                                eventType: 'condition_assigned',
                                problemId: 'instructor-override',
                                conditionId: e.target.value,
                                strategyAssigned: e.target.value,
                                payload: {
                                  profile: e.target.value,
                                  strategy: 'static',
                                  reason: 'instructor_override'
                                }
                              };
                              storage.saveInteraction(overrideEvent);
                              setToastMessage(`Profile updated for ${student.name}`);
                              // Refresh data
                              setInteractions([...storage.getAllInteractions()]);
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="">Override...</option>
                          <option value="fast">Fast</option>
                          <option value="slow">Slow</option>
                          <option value="adaptive">Adaptive</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!showDemoData && normalizedProfiles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No adaptive data available yet. Students need to interact with the system.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Concept Mastery */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="size-5" />
                    Class Concept Mastery
                  </CardTitle>
                  <CardDescription>Average mastery rates across key SQL concepts</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/research')}>
                  View Details
                  <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {classStats.conceptMastery.map((concept) => (
                  <div key={concept.concept} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{concept.concept}</span>
                      <span className={`font-semibold ${
                        concept.masteryRate >= 70 ? 'text-green-600' :
                        concept.masteryRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {concept.masteryRate}%
                      </span>
                    </div>
                    <Progress 
                      value={concept.masteryRate} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Common Error Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="size-5 text-red-500" />
                Common Errors
              </CardTitle>
              <CardDescription>Frequently encountered error patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {classStats.commonErrors.map((error, idx) => (
                  <div 
                    key={error.type} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center justify-center size-6 rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-red-100 text-red-700' :
                        idx === 1 ? 'bg-orange-100 text-orange-700' :
                        idx === 2 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium">{error.type}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{error.count}</p>
                      <p className="text-xs text-gray-500">{error.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4" 
                onClick={() => navigate('/research')}
              >
                View All Patterns
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Student Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Student Overview
                </CardTitle>
                <CardDescription>Recent activity and progress for each student</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/textbook')}>
                <BookOpen className="size-4 mr-1" />
                My Textbook
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Student</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Concepts Covered</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Last Active</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(hasRealData ? normalizedProfiles.map(p => ({ 
                    id: p.id, 
                    name: p.name,  // already normalized
                    email: `${p.id}@local`, 
                    lastActive: p.lastActive  // already normalized
                  })) : showDemoData ? DEMO_STUDENTS : []).map((student) => {
                    const profile = normalizedProfiles.find(p => p.id === student.id);
                    // Deterministic pseudo-random based on student ID to avoid hydration mismatch
                    const conceptsCount = profile?.conceptsCovered.size || (student.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 4) + 1;
                    const isActive = student.lastActive && Date.now() - student.lastActive < 3600000;
                    
                    return (
                      <tr key={student.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-gray-500">{student.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                            {isActive ? 'Active' : 'Away'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="size-4 text-yellow-500" />
                            <span className="font-medium">{conceptsCount}</span>
                            <span className="text-sm text-gray-500">/ 6 concepts</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatLastActive(student.lastActive)}
                        </td>
                        <td className="py-3 px-4">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/textbook?learnerId=${student.id}`)}
                          >
                            <FileText className="size-4 mr-1" />
                            View Textbook
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!hasRealData && !showDemoData && (
                <div className="text-center py-12 text-gray-500">
                  <Users className="size-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium">No students yet</p>
                  <p className="text-sm mt-1">Student data will appear here once students begin using the system.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* Student Preview Modal - Using Dialog Component with Portal */}
      <Dialog 
        open={showPreviewModal} 
        onOpenChange={setShowPreviewModal}
        key={`preview-modal-${showPreviewModal}`}
      >
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <Eye className="size-6 text-white" />
                <DialogTitle className="text-xl font-bold text-white">Student Preview</DialogTitle>
              </div>
              <DialogDescription className="text-blue-100 text-sm">
                Configure preview settings and experience the platform as a student
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-6">
            {/* Profile Selection */}
            <div className="space-y-3">
              <label aria-label="Escalation Profile" className="text-sm font-medium text-gray-700">
                Escalation Profile
              </label>
              <p className="text-xs text-gray-500">
                Choose how hints will escalate during the preview
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'fast', label: 'Fast Escalator', desc: 'Quick intervention', color: 'border-red-200 hover:bg-red-50' },
                  { id: 'slow', label: 'Slow Escalator', desc: 'Extended exploration', color: 'border-blue-200 hover:bg-blue-50' },
                  { id: 'adaptive', label: 'Adaptive', desc: 'Balanced approach', color: 'border-green-200 hover:bg-green-50' },
                  { id: 'explanation-first', label: 'Explanation First', desc: 'Immediate help', color: 'border-purple-200 hover:bg-purple-50' },
                ].map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setPreviewProfile(profile.id as typeof previewProfile)}
                    className={`p-3 border-2 rounded-lg text-left transition-all ${
                      previewProfile === profile.id 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : `border-gray-200 ${profile.color}`
                    }`}
                  >
                    <p className={`font-medium text-sm ${
                      previewProfile === profile.id ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {profile.label}
                    </p>
                    <p className={`text-xs mt-1 ${
                      previewProfile === profile.id ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {profile.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-900 mb-2">What to expect</h4>
              <ul className="text-xs text-amber-700 space-y-1 list-disc ml-4">
                <li>You'll see the student interface without instructor controls</li>
                <li>No debug panels or testing controls will be visible</li>
                <li>Your interactions won't affect real student data</li>
                <li>Use the Role selector in the header to return to instructor view</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowPreviewModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  // Prevent any default form submission behavior
                  e.preventDefault();
                  e.stopPropagation();
                  
                  try {
                    // Save the preview profile override to localStorage with cross-tab sync
                    // Map UI values to actual profile IDs (explanation-first doesn't have -escalator suffix)
                    const profileIdMap: Record<string, string> = {
                      'fast': 'fast-escalator',
                      'slow': 'slow-escalator',
                      'adaptive': 'adaptive-escalator',
                      'explanation-first': 'explanation-first'
                    };
                    const actualProfileId = profileIdMap[previewProfile] || `${previewProfile}-escalator`;
                    // Set debug profile with cross-tab sync
                    setDebugProfileWithSync(actualProfileId);
                    // Also set assignment strategy to static for consistent experience (with sync)
                    setDebugStrategyWithSync('static');
                    // Set a preview mode flag to indicate we're in preview mode
                    localStorage.setItem('sql-adapt-preview-mode', 'true');
                    // Broadcast to other tabs for cross-tab sync
                    broadcastSync('sql-adapt-preview-mode', 'true');
                    
                    // Close modal first
                    setShowPreviewModal(false);
                    
                    // Use setTimeout to ensure state updates and localStorage writes complete
                    // before navigation starts (100ms for reliability)
                    setTimeout(() => {
                      // Use window.location.assign for more reliable navigation
                      window.location.assign('/practice');
                    }, 100);
                  } catch (error) {
                    console.error('[Student Preview] Failed to start preview mode:', error);
                    alert('Failed to start preview mode. Please check browser storage permissions and try again.');
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                type="button"
              >
                <Play className="size-4 mr-2" />
                Start Preview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
