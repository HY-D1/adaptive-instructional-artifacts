import { Route, Lightbulb, CalendarDays, BarChart3, GitBranch, ExternalLink, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';
import type { Project } from '../../../lib/projects-data';
import { projectTagColors } from '../../../lib/projects-data';

const iconMap = {
  route: Route,
  lightbulb: Lightbulb,
  calendar: CalendarDays,
  'bar-chart': BarChart3,
  'git-branch': GitBranch,
};

const projectGradients: Record<string, string> = {
  'adaptive-problem-selector': 'from-blue-500/10 via-indigo-500/5 to-cyan-500/10 dark:from-blue-500/15 dark:via-indigo-500/10 dark:to-cyan-500/15',
  'intelligent-hint-system': 'from-amber-500/10 via-orange-500/5 to-yellow-500/10 dark:from-amber-500/15 dark:via-orange-500/10 dark:to-yellow-500/15',
  'reinforcement-scheduler': 'from-emerald-500/10 via-teal-500/5 to-green-500/10 dark:from-emerald-500/15 dark:via-teal-500/10 dark:to-green-500/15',
  'learner-analytics': 'from-rose-500/10 via-pink-500/5 to-fuchsia-500/10 dark:from-rose-500/15 dark:via-pink-500/10 dark:to-fuchsia-500/15',
  'error-transition-analysis': 'from-red-500/10 via-orange-500/5 to-amber-500/10 dark:from-red-500/15 dark:via-orange-500/10 dark:to-amber-500/15',
};

const projectAccentColors: Record<string, string> = {
  'adaptive-problem-selector': 'text-blue-600',
  'intelligent-hint-system': 'text-amber-600',
  'reinforcement-scheduler': 'text-emerald-600',
  'learner-analytics': 'text-rose-600',
  'error-transition-analysis': 'text-red-600',
};

interface ProjectCardProps {
  project: Project;
  compact?: boolean;
}

export function ProjectCard({ project, compact = false }: ProjectCardProps) {
  const Icon = iconMap[project.iconName];
  const gradient = projectGradients[project.id] ?? 'from-gray-500/10 to-gray-500/5';
  const accentColor = projectAccentColors[project.id] ?? 'text-primary';

  return (
    <Card
      className={cn(
        'group flex flex-col h-full transition-all duration-300 overflow-hidden',
        'hover:shadow-lg hover:-translate-y-0.5',
        'border-border/60 hover:border-primary/20',
        'dark:border-gray-700/60 dark:hover:border-primary/30'
      )}
    >
      {/* Thumbnail area */}
      <div
        className={cn(
          'relative h-32 bg-gradient-to-br flex items-center justify-center overflow-hidden',
          gradient
        )}
      >
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)',
              backgroundSize: '1.5rem 1.5rem',
            }}
          />
        </div>

        {/* Center icon */}
        <div
          className={cn(
            'relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl shadow-sm',
            'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm',
            'transition-transform duration-300 group-hover:scale-110'
          )}
        >
          <Icon className={cn('size-7', accentColor)} />
        </div>

        {/* Status dot */}
        {project.status === 'active' && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm text-xs font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Active
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg font-semibold leading-tight group-hover:text-primary transition-colors">
            {project.title}
          </CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed mt-2 line-clamp-3">
          {compact ? project.description : project.longDescription || project.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        <div className="flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-md',
                projectTagColors[tag] ?? 'bg-muted text-muted-foreground'
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-0 pb-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="group/btn -ml-2 text-primary hover:text-primary hover:bg-primary/5"
        >
          <a
            href={project.href}
            target={project.external ? '_blank' : undefined}
            rel={project.external ? 'noopener noreferrer' : undefined}
            className="flex items-center gap-1.5"
          >
            {project.external ? (
              <>
                Learn More
                <ExternalLink className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
              </>
            ) : (
              <>
                Try It
                <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
              </>
            )}
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
