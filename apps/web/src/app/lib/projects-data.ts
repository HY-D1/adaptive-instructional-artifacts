/**
 * SQL-Adapt research modules data
 * Static data for the public research showcase page.
 */

export interface Project {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  href: string;
  external: boolean;
  tags: string[];
  iconName: 'route' | 'lightbulb' | 'calendar' | 'bar-chart' | 'git-branch';
  status: 'active' | 'archived' | 'ongoing';
}

export const projects: Project[] = [
  {
    id: 'adaptive-problem-selector',
    title: 'Adaptive Problem Selector',
    description:
      'Difficulty-based global sequencing engine that ranks SQL problems by composite difficulty and applies topic-continuity bonuses.',
    longDescription:
      'A difficulty-based global sequencing engine that ranks SQL problems by composite difficulty scores across multiple dimensions. Applies topic-continuity bonuses to prevent jarring curriculum jumps and maintains smooth pedagogical flow.',
    href: '/',
    external: false,
    tags: ['Adaptive Sequencing', 'Difficulty Scaling', 'Curriculum Optimization'],
    iconName: 'route',
    status: 'active',
  },
  {
    id: 'intelligent-hint-system',
    title: 'Intelligent Hint System',
    description:
      'Three-rung progressive scaffolding with retrieval-augmented generation hybridizing textbook content and LLM output.',
    longDescription:
      'A three-rung progressive scaffolding state machine delivering micro-hints, detailed explanations, and reflective study notes. Uses retrieval-augmented generation to hybridize textbook content with LLM output for deeply personalized guidance.',
    href: '/',
    external: false,
    tags: ['Intelligent Tutoring', 'RAG', 'Instructional Scaffolding'],
    iconName: 'lightbulb',
    status: 'active',
  },
  {
    id: 'reinforcement-scheduler',
    title: 'Reinforcement Scheduler',
    description:
      'Spaced-repetition engine scheduling knowledge-consolidation prompts at adaptive intervals via MCQs and SQL completions.',
    longDescription:
      'A spaced-repetition engine that schedules knowledge-consolidation prompts at adaptive 1-, 3-, and 7-day intervals. Uses MCQs, SQL completions, and open-ended explanations to reinforce long-term retention.',
    href: '/',
    external: false,
    tags: ['Spaced Repetition', 'Knowledge Retention', 'Reinforcement Learning'],
    iconName: 'calendar',
    status: 'active',
  },
  {
    id: 'learner-analytics',
    title: 'Learner Analytics Engine',
    description:
      'Educational data-mining pipeline computing hint-dependency trajectories and clustering learners into behavioral archetypes.',
    longDescription:
      'An educational data-mining pipeline that computes per-learner hint-dependency trajectories over time. Applies k-means clustering on behavioral features to identify distinct learner archetypes and inform adaptive interventions.',
    href: '/',
    external: false,
    tags: ['Learner Modeling', 'Clustering', 'Educational Data Mining'],
    iconName: 'bar-chart',
    status: 'active',
  },
  {
    id: 'error-transition-analysis',
    title: 'Error Transition Analysis',
    description:
      'Markov-style error-transition matrices detecting persistent error chains and enabling LLM-assisted A/B policy comparison.',
    longDescription:
      'Builds Markov-style error-transition matrices from learner interaction logs to detect persistent error chains and conceptual misconceptions. Includes policy-variant comparison tooling for LLM-assisted A/B testing of instructional strategies.',
    href: '/',
    external: false,
    tags: ['Error Analysis', 'Policy Comparison', 'Learning Analytics'],
    iconName: 'git-branch',
    status: 'active',
  },
];

export const projectTagColors: Record<string, string> = {
  'Adaptive Sequencing': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'Difficulty Scaling': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  'Curriculum Optimization': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'Intelligent Tutoring': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'RAG': 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  'Instructional Scaffolding': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  'Spaced Repetition': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'Knowledge Retention': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  'Reinforcement Learning': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  'Learner Modeling': 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  'Clustering': 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',
  'Educational Data Mining': 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
  'Error Analysis': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  'Policy Comparison': 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  'Learning Analytics': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
};
