import {
  ArrowLeft,
  Brain,
  Gamepad2,
  Code2,
  Sparkles,
  ArrowUpRight,
  GraduationCap,
  Database,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ProjectCard } from '../components/features/projects/ProjectCard';
import { projects } from '../lib/projects-data';
import { useNavigate } from 'react-router';

const researchAreas = [
  { label: 'Adaptive Learning', icon: Sparkles },
  { label: 'Metacognition', icon: Brain },
  { label: 'Gamification', icon: Gamepad2 },
  { label: 'AI in Education', icon: Code2 },
  { label: 'Learning Analytics', icon: Code2 },
  { label: 'Scaffolding', icon: GraduationCap },
];

/**
 * ProjectsPage — SQL-Adapt research modules showcase
 *
 * Displays the core research features and adaptive systems
 * that power the SQL-Adapt learning platform.
 * No authentication required; accessible to all visitors.
 */
export function ProjectsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-900 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Database className="size-5 text-primary" />
                Research
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '2rem 2rem',
            }}
          />
        </div>
        <div className="container mx-auto px-4 py-16 md:py-20 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 dark:bg-primary/10 text-primary text-sm font-medium mb-6">
              <Database className="size-4" />
              SQL-Adapt
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Adaptive SQL Learning
              <br />
              Through AI &amp; Gamification
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              An adaptive SQL learning platform that personalizes hints, explanations,
              and study notes based on each student&apos;s mistakes and progress — using
              a 23-error-subtype taxonomy and LLM-augmented retrieval.
            </p>

            {/* Research area pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {researchAreas.map((area) => (
                <Badge
                  key={area.label}
                  variant="outline"
                  className="px-3 py-1.5 text-sm font-normal rounded-full border-primary/20 hover:bg-primary/5 transition-colors cursor-default"
                >
                  <area.icon className="size-3.5 mr-1.5" />
                  {area.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission statement card */}
      <section className="container mx-auto px-4 -mt-6 relative z-10">
        <div className="max-w-3xl mx-auto bg-primary text-primary-foreground rounded-xl p-6 md:p-8 shadow-lg">
          <p className="text-base md:text-lg leading-relaxed">
            SQL-Adapt tracks how learners think in real time, adapts to where they
            struggle, and refuses to short-circuit the effort that drives genuine growth.
            Our work spans adaptive problem selection, intelligent scaffolding,
            spaced-repetition reinforcement, and educational data mining — all oriented
            toward one goal: augmenting human performance, not replacing it.
          </p>
        </div>
      </section>

      {/* Projects */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-2xl md:text-3xl font-bold mb-3">Research Modules</h3>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Core adaptive systems powering the SQL-Adapt learning platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t dark:border-gray-700 bg-muted/30 dark:bg-gray-900/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-3">Experience SQL-Adapt</h3>
            <p className="text-muted-foreground mb-6">
              Try the platform and see how adaptive SQL learning works in practice.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate('/')}>
                Get Started
                <ArrowUpRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t dark:border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} SQL-Adapt. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ProjectsPage;
