import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  BarChart3, 
  BookOpen, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  ArrowRight,
  GraduationCap,
  Lightbulb,
  Target,
  Activity,
  ChevronRight,
  FileText
} from 'lucide-react';
import { storage } from '../lib/storage';
import { useUserRole } from '../hooks/useUserRole';
import type { LearnerProfile, InteractionEvent } from '../types';

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

// Mock class statistics
interface ClassStats {
  totalStudents: number;
  activeToday: number;
  avgProgress: number;
  totalInteractions: number;
  commonErrors: Array<{ type: string; count: number; percentage: number }>;
  conceptMastery: Array<{ concept: string; masteryRate: number }>;
}

/**
 * InstructorDashboard - Overview dashboard for instructors
 * 
 * Displays:
 * - Class statistics (student count, activity, progress)
 * - Concept mastery rates across the class
 * - Common error patterns
 * - Recent student activity
 * 
 * Includes mock/demo data for MVP - real backend integration pending.
 * Redirects students to home page (instructor-only access).
 */
export function InstructorDashboard() {
  const navigate = useNavigate();
  const { isStudent, isLoading } = useUserRole();
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Redirect students away from instructor pages
  useEffect(() => {
    if (!isLoading && isStudent) {
      navigate('/', { replace: true });
    }
  }, [isStudent, isLoading, navigate]);

  // Load data from storage
  useEffect(() => {
    const loadData = () => {
      const allProfiles = storage.getAllProfiles().map(p => storage.getProfile(p.id)).filter(Boolean) as LearnerProfile[];
      const allInteractions = storage.getAllInteractions();
      setProfiles(allProfiles);
      setInteractions(allInteractions);
      setIsDataLoading(false);
    };
    loadData();
  }, []);

  // Determine if we should show demo data
  const hasRealData = profiles.length > 0 || interactions.length > 0;
  const showDemoData = DEMO_MODE && !hasRealData;

  // Calculate class statistics
  const classStats: ClassStats = useMemo(() => {
    // Use real profiles if available, otherwise use demo students in dev mode
    const studentList = hasRealData ? profiles : (showDemoData ? DEMO_STUDENTS : []);
    const totalStudents = studentList.length;
    const activeToday = studentList.filter(s => Date.now() - s.lastActive < 86400000).length;
    
    // Calculate average progress based on concept coverage
    const avgProgress = profiles.length > 0
      ? Math.round(profiles.reduce((sum, p) => sum + p.conceptsCovered.size, 0) / profiles.length / 6 * 100)
      : (showDemoData ? 45 : 0);

    // Use real interactions or add demo interactions in dev mode
    const totalInteractions = interactions.length + (showDemoData ? DEMO_STATS.interactions : 0);

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
  }, [profiles, interactions, hasRealData, showDemoData]);

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

  if (isLoading || isDataLoading) {
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
              <Badge variant="outline" className="text-sm px-3 py-1">
                <Users className="size-3 mr-1" />
                {classStats.totalStudents} Students
              </Badge>
            </div>
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

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/textbook-review')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-emerald-50">
                    <BookOpen className="size-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Textbook Review</h3>
                    <p className="text-sm text-gray-600 mt-1">Review student textbooks and identify misconceptions</p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-400" />
              </div>
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
              <Button variant="outline" size="sm" onClick={() => navigate('/textbook-review')}>
                <BookOpen className="size-4 mr-1" />
                View Textbooks
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
                  {(hasRealData ? profiles.map(p => ({ 
                    id: p.id, 
                    name: p.name || p.id, 
                    email: `${p.id}@local`, 
                    lastActive: p.createdAt 
                  })) : showDemoData ? DEMO_STUDENTS : []).map((student) => {
                    const profile = profiles.find(p => p.id === student.id);
                    // Deterministic pseudo-random based on student ID to avoid hydration mismatch
                    const conceptsCount = profile?.conceptsCovered.size || (student.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 4) + 1;
                    const isActive = Date.now() - student.lastActive < 3600000;
                    
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
                          {new Date(student.lastActive).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
    </div>
  );
}
