"use client";

import * as React from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import { 
  Search, 
  BookOpen, 
  FileText, 
  Layout, 
  GraduationCap, 
  Clock,
  ArrowRight,
  History,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '../ui/utils';
import { useCommandSearch, type SearchItem } from '../../hooks/useCommandSearch';
import { Dialog, DialogContent } from '../ui/dialog';

interface CommandMenuProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

// Difficulty badge colors
const difficultyColors = {
  beginner: 'bg-green-100 text-green-800 border-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  advanced: 'bg-red-100 text-red-800 border-red-200',
};

// Type icons
const typeIcons = {
  concept: BookOpen,
  problem: FileText,
  page: Layout,
};

// Type labels
const typeLabels = {
  concept: 'Concept',
  problem: 'Problem',
  page: 'Page',
};

export function CommandMenu({ open: controlledOpen, onOpenChange }: CommandMenuProps = {}) {
  const navigate = useNavigate();
  const {
    isOpen: hookOpen,
    openMenu,
    closeMenu,
    query,
    setQuery,
    isLoading,
    recentSearches,
    filteredItems,
    groupedResults,
    saveRecentSearch,
  } = useCommandSearch({ maxResults: 15 });

  // Support both controlled and uncontrolled modes
  const isOpen = controlledOpen !== undefined ? controlledOpen : hookOpen;
  const handleOpenChange = onOpenChange || ((open: boolean) => (open ? openMenu() : closeMenu()));

  // Handle item selection
  const handleSelect = React.useCallback((item: SearchItem) => {
    saveRecentSearch(item);
    handleOpenChange(false);
    setQuery('');
    navigate(item.url);
  }, [navigate, saveRecentSearch, handleOpenChange, setQuery]);

  // Group label component
  const GroupLabel = ({ children, count }: { children: React.ReactNode; count?: number }) => (
    <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
      <span>{children}</span>
      {count !== undefined && count > 0 && (
        <span className="text-gray-400">{count}</span>
      )}
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Search className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-gray-600 font-medium mb-1">No results found</p>
      <p className="text-sm text-gray-400 max-w-xs">
        Try searching for SQL concepts like "JOIN", "WHERE", or "aggregation"
      </p>
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {['SELECT', 'JOIN', 'GROUP BY', 'subquery'].map((term) => (
          <button
            key={term}
            onClick={() => setQuery(term)}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );

  // Loading state
  const LoadingState = () => (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading search index...
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden border-0 bg-transparent shadow-2xl">
        <Command
          className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-2xl"
          label="Global search"
          shouldFilter={false}
          loop
        >
          {/* Search input */}
          <div className="flex items-center border-b border-gray-100 px-4">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <Command.Input
              placeholder="Search concepts, problems, or pages..."
              className="flex-1 h-14 bg-transparent text-gray-900 placeholder:text-gray-400 outline-none text-base"
              value={query}
              onValueChange={setQuery}
              autoFocus
            />
            <div className="flex items-center gap-2">
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded">
                <span>ESC</span>
              </kbd>
            </div>
          </div>

          {/* Results */}
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {isLoading ? (
              <LoadingState />
            ) : query.trim() === '' ? (
              // Default view - show recent and suggestions
              <>
                {recentSearches.length > 0 && (
                  <Command.Group>
                    <GroupLabel count={recentSearches.length}>
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" />
                        Recent
                      </span>
                    </GroupLabel>
                    {recentSearches.map((item) => (
                      <CommandItem
                        key={item.id}
                        item={item}
                        onSelect={handleSelect}
                      />
                    ))}
                  </Command.Group>
                )}
                <Command.Group>
                  <GroupLabel>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Suggestions
                    </span>
                  </GroupLabel>
                  <CommandItem
                    item={{
                      id: 'suggest-concepts',
                      type: 'page',
                      title: 'Browse all concepts',
                      description: 'Explore SQL concepts from basic SELECT to advanced subqueries',
                      url: '/concepts',
                      keywords: [],
                    }}
                    onSelect={handleSelect}
                    icon={BookOpen}
                  />
                  <CommandItem
                    item={{
                      id: 'suggest-practice',
                      type: 'page',
                      title: 'Start practicing',
                      description: 'Jump into hands-on SQL exercises',
                      url: '/practice',
                      keywords: [],
                    }}
                    onSelect={handleSelect}
                    icon={GraduationCap}
                  />
                </Command.Group>
              </>
            ) : filteredItems.length === 0 ? (
              <EmptyState />
            ) : (
              // Search results grouped by type
              <>
                {groupedResults?.pages && groupedResults.pages.length > 0 && (
                  <Command.Group>
                    <GroupLabel count={groupedResults.pages.length}>Pages</GroupLabel>
                    {groupedResults.pages.map((item) => (
                      <CommandItem key={item.id} item={item} onSelect={handleSelect} />
                    ))}
                  </Command.Group>
                )}
                {groupedResults?.concepts && groupedResults.concepts.length > 0 && (
                  <Command.Group>
                    <GroupLabel count={groupedResults.concepts.length}>Concepts</GroupLabel>
                    {groupedResults.concepts.map((item) => (
                      <CommandItem key={item.id} item={item} onSelect={handleSelect} />
                    ))}
                  </Command.Group>
                )}
                {groupedResults?.problems && groupedResults.problems.length > 0 && (
                  <Command.Group>
                    <GroupLabel count={groupedResults.problems.length}>Problems</GroupLabel>
                    {groupedResults.problems.map((item) => (
                      <CommandItem key={item.id} item={item} onSelect={handleSelect} />
                    ))}
                  </Command.Group>
                )}
              </>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-gray-600 font-sans">↑↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border rounded text-gray-600 font-sans">↵</kbd>
                to select
              </span>
            </div>
            <span className="hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 bg-white border rounded text-gray-600 font-sans">⌘K</kbd> to toggle
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Command Item component
interface CommandItemProps {
  item: SearchItem;
  onSelect: (item: SearchItem) => void;
  icon?: React.ComponentType<{ className?: string }>;
}

function CommandItem({ item, onSelect, icon: CustomIcon }: CommandItemProps) {
  const Icon = CustomIcon || typeIcons[item.type];
  const label = typeLabels[item.type];

  return (
    <Command.Item
      value={item.id}
      onSelect={() => onSelect(item)}
      className={cn(
        "flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer",
        "data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900",
        "hover:bg-gray-50 transition-colors outline-none"
      )}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">{item.title}</span>
          {item.difficulty && (
            <span className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded border",
              difficultyColors[item.difficulty]
            )}>
              {item.difficulty}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-[10px] uppercase tracking-wide hidden sm:inline">{label}</span>
        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Command.Item>
  );
}

// Command Trigger Button
interface CommandTriggerProps {
  className?: string;
  variant?: 'default' | 'minimal';
}

export function CommandTrigger({ className, variant = 'default' }: CommandTriggerProps) {
  const { openMenu } = useCommandSearch();

  if (variant === 'minimal') {
    return (
      <button
        onClick={openMenu}
        className={cn(
          "p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors",
          className
        )}
        aria-label="Open search"
      >
        <Search className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={openMenu}
      aria-label="Open global search"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50",
        "text-gray-500 text-sm transition-all",
        className
      )}
    >
      <Search className="w-4 h-4" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-100 rounded ml-2">
        ⌘K
      </kbd>
    </button>
  );
}

export default CommandMenu;
