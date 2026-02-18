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

// Mock student data for instructor view
const MOCK_STUDENTS = [
  { id: 'student-1', name: 'Alice Chen', email: 'alice.chen@school.edu', lastActive: Date.now() - 3600000 },
  { id: 'student-2', name: 'Bob Martinez', email: 'bob.m@school.edu', lastActive: Date.now() - 7200000 },
  { id: 'student-3', name: 'Carol Williams', email: 'carol.w@school.edu', lastActive: Date.now() - 1800000 },
  { id: 'student-4', name: 'David Kim', email: 'david.kim@school.edu', lastActive: Date.now() - 86400000 },
  { id: 'student-5', name: 'Emma Johnson', email: 'emma.j@school.edu', lastActive: Date.now() - 10800000 },
];

// Mock class statistics
interface ClassStats {
  totalStudents: number;
  activeToday: number;
  avgProgress: number;
  totalInteractions: number;
  commonErrors: Array<{ type: string; count: number; percentage: number }>;
  conceptMastery: Array<{ concept: string; masteryRate: number }>;
}

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

  // Calculate class statistics
  const classStats: ClassStats = useMemo(() => {
    const totalStudents = MOCK_STUDENTS.length;
    const activeToday = MOCK_STUDENTS.filter(s => Date.now() - s.lastActive < 86400000).length;
    
    // Calculate average progress based on concept coverage
    const avgProgress = profiles.length > 0
      ? Math.round(profiles.reduce((sum, p) => sum + p.conceptsCovered.size, 0) / profiles.length / 6 * 100)
      : 45; // Default mock value

    // Get all interactions including mock data simulation
    const totalInteractions = interactions.length + 127; // Add mock interactions

    // Analyze common errors from real data + mock patterns
    const errorCounts = interactions
      .filter(i => i.eventType === 'error' && i.errorSubtypeId)
      .reduce((acc, i) => {
        acc[i.errorSubtypeId!] = (acc[i.errorSubtypeId!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Add mock error patterns
    const mockErrors = [
      { type: 'syntax-error', count: 12 },
      { type: 'missing-join-condition', count: 8 },
      { type: 'aggregate-misuse', count: 6 },
      { type: 'subquery-error', count: 5 },
    ];

    mockErrors.forEach(e => {
      errorCounts[e.type] = (errorCounts[e.type] || 0) + e.count;
    });

    const totalErrors = Object.values(errorCounts).reduce((a, b) => a + b, 0) || 1;
    const commonErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({
        type: type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count,
        percentage: Math.round((count / totalErrors) * 100)
      }));

    // Concept mastery rates
    const conceptMastery = [
      { concept: 'SELECT Basics', masteryRate: 78 },
      { concept: 'WHERE Clause', masteryRate: 65 },
      { concept: 'JOIN Operations', masteryRate: 42 },
      { concept: 'Aggregations', masteryRate: 35 },
      { concept: 'Subqueries', masteryRate: 28 },
    ];

    return {
      totalStudents,
      activeToday,
      avgProgress: Math.min(avgProgress || 45, 100),
      totalInteractions,
      commonErrors: commonErrors.length > 0 ? commonErrors : mockErrors.map(e => ({
        type: e.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: e.count,
        percentage: Math.round((e.count / 31) * 100)
      })),
      conceptMastery
    };
  }, [profiles, interactions]);

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
                  {MOCK_STUDENTS.map((student) => {
                    const profile = profiles.find(p => p.id === student.id);
                    const conceptsCount = profile?.conceptsCovered.size || Math.floor(Math.random() * 4) + 1;
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
                            onClick={() => navigate(`/textbook-review?learnerId=${student.id}`)}
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
