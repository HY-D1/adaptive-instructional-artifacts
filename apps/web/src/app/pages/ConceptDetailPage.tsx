import { useParams, Link } from 'react-router';
import { useEffect, useState } from 'react';
import { loadConceptContent, getProblemsForConcept, type LoadedConcept, type CodeExample, type Mistake } from '../lib/concept-loader';
import { ChevronLeft, BookOpen, Clock, Dumbbell, AlertCircle, CheckCircle, XCircle, Lightbulb, Play } from 'lucide-react';

export function ConceptDetailPage() {
  const { '*': conceptId } = useParams<{ '*': string }>();
  const [concept, setConcept] = useState<LoadedConcept | null>(null);
  const [problems, setProblems] = useState<ReturnType<typeof getProblemsForConcept>>([]);
  const [activeTab, setActiveTab] = useState<'learn' | 'examples' | 'mistakes'>('learn');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!conceptId) return;
    
    const loadData = async () => {
      const [conceptData] = await Promise.all([
        loadConceptContent(conceptId),
        Promise.resolve(setProblems(getProblemsForConcept(conceptId)))
      ]);
      setConcept(conceptData);
      setLoading(false);
    };
    
    loadData();
  }, [conceptId]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading concept...</div>
      </div>
    );
  }
  
  if (!concept) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Concept Not Found</h2>
          <p className="text-gray-600 mb-4">The concept "{conceptId}" doesn't exist in the textbook.</p>
          <Link to="/concepts" className="text-blue-600 hover:underline">
            ← Back to Textbook
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/concepts" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{concept.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {concept.estimatedReadTime} min read
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  Pages {concept.pageNumbers.join(', ')}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyStyle(concept.difficulty)}`}>
                  {concept.difficulty}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-white p-1 rounded-lg border">
              {(['learn', 'examples', 'mistakes'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 px-4 rounded-md capitalize text-sm font-medium transition-colors ${
                    activeTab === tab 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'learn' && 'Learn'}
                  {tab === 'examples' && 'Examples'}
                  {tab === 'mistakes' && 'Common Mistakes'}
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            <div className="bg-white rounded-xl border shadow-sm">
              {activeTab === 'learn' && <LearnTab content={concept.content} />}
              {activeTab === 'examples' && <ExamplesTab examples={concept.content.examples} />}
              {activeTab === 'mistakes' && <MistakesTab mistakes={concept.content.commonMistakes} />}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Practice Card */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-blue-600" />
                Practice Problems
              </h3>
              
              {problems.length > 0 ? (
                <div className="space-y-3">
                  {problems.slice(0, 3).map(problem => (
                    <Link
                      key={problem.id}
                      to={`/practice?problemId=${problem.id}&conceptId=${conceptId}`}
                      className="block p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 transition-all group"
                    >
                      <p className="font-medium text-gray-900 group-hover:text-blue-700">{problem.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getDifficultyLightStyle(problem.difficulty)}`}>
                          {problem.difficulty}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {problems.length > 3 && (
                    <Link 
                      to={`/practice?conceptId=${conceptId}`}
                      className="block text-center text-blue-600 text-sm hover:underline py-2"
                    >
                      View all {problems.length} problems →
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No practice problems for this concept yet.</p>
              )}
              
              <Link
                to={`/practice?conceptId=${conceptId}`}
                className="mt-4 flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Play className="w-4 h-4" />
                Start Practicing
              </Link>
            </div>
            
            {/* Related Concepts */}
            {concept.relatedConcepts.length > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Related Concepts</h3>
                <div className="space-y-2">
                  {concept.relatedConcepts.slice(0, 5).map(relatedId => (
                    <Link
                      key={relatedId}
                      to={`/concepts/${relatedId}`}
                      className="block text-gray-700 hover:text-blue-600 hover:bg-gray-50 p-2 rounded-lg transition-colors text-sm"
                    >
                      → {relatedId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {/* Textbook Source */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Textbook Source
              </h3>
              <p className="text-sm text-blue-800 mb-2">
                Content extracted from official SQL Course Textbook
              </p>
              <p className="text-xs text-blue-600">
                Pages: {concept.pageNumbers.join(', ')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LearnTab({ content }: { content: LoadedConcept['content'] }) {
  return (
    <div className="p-6">
      {/* Definition Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-5 mb-6 rounded-r-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-1 uppercase tracking-wide">Definition</h3>
        <p className="text-blue-900 text-lg leading-relaxed">{content.definition}</p>
      </div>
      
      {/* Explanation */}
      <div className="prose max-w-none">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Explanation</h3>
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {content.explanation}
        </div>
      </div>
    </div>
  );
}

function ExamplesTab({ examples }: { examples: CodeExample[] }) {
  if (examples.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        No examples available for this concept.
      </div>
    );
  }
  
  return (
    <div className="divide-y">
      {examples.map((ex, i) => (
        <div key={i} className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-gray-900">{ex.title}</h4>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4 mb-3 overflow-x-auto">
            <pre className="text-green-400 font-mono text-sm">
              <code>{ex.code}</code>
            </pre>
          </div>
          
          <p className="text-gray-600 text-sm leading-relaxed">{ex.explanation}</p>
          
          {ex.output && (
            <div className="mt-3 p-3 bg-gray-100 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Output:</p>
              <p className="text-sm text-gray-700 font-mono">{ex.output}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MistakesTab({ mistakes }: { mistakes: Mistake[] }) {
  if (mistakes.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        No common mistakes listed for this concept.
      </div>
    );
  }
  
  return (
    <div className="divide-y">
      {mistakes.map((mistake, i) => (
        <div key={i} className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-gray-900">{mistake.title}</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Incorrect */}
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <div className="bg-red-50 px-3 py-2 border-b border-red-200 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Incorrect</span>
              </div>
              <div className="p-3 bg-red-50/50">
                <pre className="text-red-700 font-mono text-sm overflow-x-auto">
                  <code>{mistake.incorrect}</code>
                </pre>
              </div>
            </div>
            
            {/* Correct */}
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div className="bg-green-50 px-3 py-2 border-b border-green-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Correct</span>
              </div>
              <div className="p-3 bg-green-50/50">
                <pre className="text-green-700 font-mono text-sm overflow-x-auto">
                  <code>{mistake.correct}</code>
                </pre>
              </div>
            </div>
          </div>
          
          {/* Why */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <Lightbulb className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 mb-1">Why this happens</p>
              <p className="text-sm text-yellow-700">{mistake.why}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getDifficultyStyle(difficulty: string): string {
  switch (difficulty) {
    case 'beginner': return 'bg-green-100 text-green-800';
    case 'intermediate': return 'bg-yellow-100 text-yellow-800';
    case 'advanced': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getDifficultyLightStyle(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return 'bg-green-100 text-green-700';
    case 'medium': return 'bg-yellow-100 text-yellow-700';
    case 'hard': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}
