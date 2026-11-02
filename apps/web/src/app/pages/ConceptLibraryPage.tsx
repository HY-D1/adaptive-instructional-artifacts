import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { listConcepts, loadConceptMap } from '../lib/content/concept-loader';
import { BookOpen, Clock, GraduationCap, Search, X } from 'lucide-react';
import { CommandTrigger } from '../components/shared/CommandMenu';
import { Input } from '../components/ui/input';
import { getConceptLesson, getLessonReadTime, TOPIC_LABELS } from '../data/concept-lessons';

export function ConceptLibraryPage() {
  const [concepts, setConcepts] = useState<Array<{id: string; title: string; difficulty: string}>>([]);
  const [filter, setFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [source, setSource] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const loadConcepts = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!await loadConceptMap()) throw new Error('Concept catalog unavailable');
      const data = await listConcepts();
      if (mounted.current) setConcepts(data);
    } catch (e) {
      if (mounted.current) setError('Failed to load concepts. Please try again.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    loadConcepts();
    return () => { mounted.current = false; };
  }, []);

  const filtered = concepts.filter(c => {
    const matchesFilter = filter === 'all' || c.difficulty === filter;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch && (topic === 'all' || getConceptLesson(c.id)?.topic === topic) && (source === 'all' || c.id.startsWith(source + '/'));
  }).sort((a, b) => {
    const topics = Object.keys(TOPIC_LABELS);
    const topicOrder = topics.indexOf(getConceptLesson(a.id)?.topic || '') - topics.indexOf(getConceptLesson(b.id)?.topic || '');
    return topicOrder || concepts.indexOf(a) - concepts.indexOf(b);
  });

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading concepts...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadConcepts}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
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
              {Math.round(concepts.reduce((acc, c) => acc + (getConceptLesson(c.id) ? getLessonReadTime(getConceptLesson(c.id)!) : getConceptTime(c.difficulty)), 0) / concepts.length) || 1}
            </div>
            <div className="text-sm text-gray-600">Avg. Minutes per Concept</div>
          </div>
        </div>
        
        {/* Search */}
        <div className="mb-6 space-y-3">
          <div className="max-w-xl space-y-2">
            <label htmlFor="concept-library-search" className="block text-sm font-medium text-gray-700">
              Search Concepts
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="concept-library-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Filter concepts by name or concept id"
                className="pl-10 pr-10"
                aria-describedby="concept-library-search-help"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                  aria-label="Clear concept search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p id="concept-library-search-help" className="text-sm text-gray-500">
              Filter the concepts on this page. Use global search to jump anywhere in the app.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CommandTrigger className="justify-start" />
            <span className="text-sm text-gray-500">
              Global search
              <span className="hidden sm:inline">
                {' '}<kbd className="px-1.5 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded">⌘K</kbd>
              </span>
            </span>
          </div>
          {searchQuery && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <Search className="w-4 h-4" />
              <span>Filtering by: "{searchQuery}"</span>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:underline ml-2"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mb-5">
          <label className="text-sm font-medium">Topic<select className="block border rounded-lg p-3 bg-white mt-1 max-w-full" value={topic} onChange={e => setTopic(e.target.value)}><option value="all">All topics</option>{Object.entries(TOPIC_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="text-sm font-medium">Source<select className="block border rounded-lg p-3 bg-white mt-1" value={source} onChange={e => setSource(e.target.value)}><option value="all">All sources</option><option value="murachs-mysql-3rd-edition">Murach’s MySQL</option><option value="dbms-ramakrishnan-3rd-edition">Database Management Systems</option></select></label>
        </div>
        <p role="status" className="mb-4 text-sm text-gray-600">{filtered.length} of {concepts.length} concepts · Follow the topic groups from foundations to administration.</p>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(diff => (
            <button
              key={diff}
              aria-pressed={filter === diff}
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
          {filtered.map((concept, index) => (
            <Fragment key={concept.id}>
            {(index === 0 || getConceptLesson(filtered[index - 1].id)?.topic !== getConceptLesson(concept.id)?.topic) && <h2 className="col-span-full mt-4 text-xl font-semibold text-gray-900">{TOPIC_LABELS[getConceptLesson(concept.id)?.topic || ''] || 'Further reading'}</h2>}
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
              <p className="text-xs text-blue-700 mb-2">{TOPIC_LABELS[getConceptLesson(concept.id)?.topic || ''] || 'Further reading'}</p>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {concept.title}
              </h3>
<p className="text-xs text-gray-500 mb-3">{concept.id.startsWith('murachs-mysql') ? "Murach’s MySQL" : concept.id.startsWith('dbms-ramakrishnan') ? 'Database Management Systems' : 'Course source'}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {getConceptLesson(concept.id) ? getLessonReadTime(getConceptLesson(concept.id)!) : getConceptTime(concept.difficulty)} min
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" />
                  Learn →
                </span>
              </div>
            </Link>
            </Fragment>
          ))}
        </div>
        
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery
              ? `No concepts found matching "${searchQuery}"`
              : 'No concepts found for this filter.'}
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
