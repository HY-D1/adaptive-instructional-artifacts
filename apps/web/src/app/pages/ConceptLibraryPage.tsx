import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listConcepts } from '../lib/concept-loader';
import { BookOpen, Clock, GraduationCap } from 'lucide-react';

export function ConceptLibraryPage() {
  const [concepts, setConcepts] = useState<Array<{id: string; title: string; difficulty: string}>>([]);
  const [filter, setFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    listConcepts().then((data) => {
      setConcepts(data);
      setLoading(false);
    });
  }, []);
  
  const filtered = filter === 'all' 
    ? concepts 
    : concepts.filter(c => c.difficulty === filter);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading textbook...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              SQL Textbook
            </h1>
          </div>
          <p className="text-gray-600 max-w-2xl">
            Learn SQL concepts step by step. Study the theory, see real examples, 
            understand common mistakes, then practice to master each concept.
          </p>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-blue-600">{concepts.length}</div>
            <div className="text-sm text-gray-600">Total Concepts</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-green-600">
              {concepts.filter(c => c.difficulty === 'beginner').length}
            </div>
            <div className="text-sm text-gray-600">Beginner Friendly</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(concepts.reduce((acc, c) => acc + (c.difficulty === 'beginner' ? 5 : c.difficulty === 'intermediate' ? 8 : 12), 0) / concepts.length) || 5}
            </div>
            <div className="text-sm text-gray-600">Avg. Minutes per Concept</div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(diff => (
            <button
              key={diff}
              onClick={() => setFilter(diff)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                filter === diff 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
            >
              {diff === 'all' ? 'All Concepts' : diff}
            </button>
          ))}
        </div>
        
        {/* Concept Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(concept => (
            <Link
              key={concept.id}
              to={`/concepts/${concept.id}`}
              className={`group p-6 rounded-xl border-2 transition-all hover:shadow-lg bg-white ${getDifficultyBorder(concept.difficulty)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyBadge(concept.difficulty)}`}>
                  {concept.difficulty}
                </span>
                <span className="text-3xl group-hover:scale-110 transition-transform">
                  {getConceptIcon(concept.id)}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {concept.title}
              </h3>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {getConceptTime(concept.difficulty)} min
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" />
                  Learn →
                </span>
              </div>
            </Link>
          ))}
        </div>
        
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No concepts found for this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function getDifficultyBorder(difficulty: string): string {
  switch (difficulty) {
    case 'beginner': return 'border-green-200 hover:border-green-400';
    case 'intermediate': return 'border-yellow-200 hover:border-yellow-400';
    case 'advanced': return 'border-red-200 hover:border-red-400';
    default: return 'border-gray-200';
  }
}

function getDifficultyBadge(difficulty: string): string {
  switch (difficulty) {
    case 'beginner': return 'bg-green-100 text-green-800';
    case 'intermediate': return 'bg-yellow-100 text-yellow-800';
    case 'advanced': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getConceptIcon(conceptId: string): string {
  if (conceptId.includes('select')) return '🔍';
  if (conceptId.includes('where')) return '🔎';
  if (conceptId.includes('join')) return '🔗';
  if (conceptId.includes('group')) return '📊';
  if (conceptId.includes('order')) return '📋';
  if (conceptId.includes('insert')) return '➕';
  if (conceptId.includes('update')) return '✏️';
  if (conceptId.includes('delete')) return '🗑️';
  if (conceptId.includes('aggregate')) return '📈';
  if (conceptId.includes('subquery')) return '🪆';
  if (conceptId.includes('view')) return '👁️';
  if (conceptId.includes('index')) return '📇';
  return '📄';
}

function getConceptTime(difficulty: string): number {
  switch (difficulty) {
    case 'beginner': return 5;
    case 'intermediate': return 8;
    case 'advanced': return 12;
    default: return 5;
  }
}
