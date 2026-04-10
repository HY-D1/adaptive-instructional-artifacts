import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Cpu,
  Thermometer,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Save,
  RotateCcw,
  Bot,
  Cloud,
  Server,
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  checkLLMHealth,
  LLMHealthStatus,
  LLMProvider,
  OLLAMA_MODEL,
  GROQ_MODEL,
  getLLMStatus,
} from '../../lib/api/llm-client';
import { safeSet } from '../../lib/storage/safe-storage';

const INITIAL_PROVIDER: LLMProvider = import.meta.env.VITE_API_BASE_URL ? 'groq' : 'ollama';

interface LLMSettings {
  provider: LLMProvider;
  temperature: number;
  topP: number;
  timeoutMs: number;
  model: string;
}

const DEFAULT_SETTINGS: LLMSettings = {
  provider: INITIAL_PROVIDER,
  temperature: 0,
  topP: 1,
  timeoutMs: 25000,
  model: INITIAL_PROVIDER === 'groq' ? GROQ_MODEL : OLLAMA_MODEL
};

const STORAGE_KEY = 'sql-adapt-llm-settings';

// Provider-specific default models
const PROVIDER_DEFAULTS: Record<LLMProvider, string> = {
  ollama: OLLAMA_MODEL,
  groq: GROQ_MODEL,
};

// Provider display names
const PROVIDER_NAMES: Record<LLMProvider, string> = {
  ollama: 'Local (Ollama)',
  groq: 'Hosted (Groq)',
};

// Provider icons
const PROVIDER_ICONS: Record<LLMProvider, typeof Server> = {
  ollama: Server,
  groq: Cloud,
};

export function LLMSettingsHelper() {
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);
  const [healthStatus, setHealthStatus] = useState<LLMHealthStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Load saved settings on mount and sync with backend provider
  useEffect(() => {
    const loadAndSyncSettings = async () => {
      try {
        const backendStatus = await getLLMStatus();
        const backendProvider = backendStatus.provider;
        if (backendStatus.models.length > 0) {
          setAvailableModels(backendStatus.models);
        }

        // Then load saved settings
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // If backend provider differs from saved, sync to backend
          if (backendProvider && parsed.provider && parsed.provider !== backendProvider) {
            const syncedSettings = {
              ...DEFAULT_SETTINGS,
              ...parsed,
              provider: backendProvider,
              model: PROVIDER_DEFAULTS[backendProvider],
            };
            setSettings(syncedSettings);
            // Save synced settings back to localStorage (cache priority - LLM settings are regenerable)
            safeSet(STORAGE_KEY, syncedSettings, { priority: 'cache' });
          } else {
            setSettings(prev => ({
              ...prev,
              ...parsed,
              ...(backendProvider ? { provider: backendProvider, model: PROVIDER_DEFAULTS[backendProvider] } : {}),
            }));
          }
        } else {
          // No saved settings - use backend provider as default
          setSettings({
            ...DEFAULT_SETTINGS,
            ...(backendProvider ? {
              provider: backendProvider,
              model: PROVIDER_DEFAULTS[backendProvider],
            } : {}),
          });
        }
      } catch {
        // Ignore parse errors, use defaults
      }
    };

    loadAndSyncSettings();
  }, []);

  // Check LLM health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const status = await checkLLMHealth();
      setHealthStatus(status);
      // Store available models from health check
      if (status.availableModels && status.availableModels.length > 0) {
        setAvailableModels(status.availableModels);
      }
    } catch {
      setHealthStatus({
        ok: false,
        provider: settings.provider,
        message: 'Failed to check LLM health',
        availableModels: [],
        enabled: false,
      });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const updateSetting = <K extends keyof LLMSettings>(
    key: K,
    value: LLMSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      // If provider changed, update model to default for that provider
      if (key === 'provider') {
        updated.model = PROVIDER_DEFAULTS[value as LLMProvider];
      }
      return updated;
    });
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const saveSettings = () => {
    // Use safeSet for quota-aware persistence (cache priority - LLM settings are regenerable)
    const result = safeSet(STORAGE_KEY, settings, { priority: 'cache' });
    
    if (result.success) {
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('llm-settings-changed', {
        detail: settings
      }));

      setHasChanges(false);
      setSaveStatus('saved');

      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const formatTimeout = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const ProviderIcon = PROVIDER_ICONS[settings.provider];

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cloud className="size-3.5 text-blue-500" />
            <span className="text-sm font-medium">Provider</span>
          </div>
        </div>
        <Select
          value={settings.provider}
          onValueChange={(value) => updateSetting('provider', value as LLMProvider)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ollama">
              <div className="flex items-center gap-2">
                <Server className="size-4" />
                {PROVIDER_NAMES.ollama}
              </div>
            </SelectItem>
            <SelectItem value="groq">
              <div className="flex items-center gap-2">
                <Cloud className="size-4" />
                {PROVIDER_NAMES.groq}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          {settings.provider === 'ollama'
            ? 'Use local Ollama instance. Requires Ollama running locally.'
            : 'Use hosted Groq API. Requires GROQ_API_KEY on backend.'}
        </p>
      </div>

      {/* Health Status */}
      <div className="flex items-center justify-between">
        {isCheckingHealth ? (
          <Badge variant="outline" className="text-xs">
            <Loader2 className="size-3 mr-1 animate-spin" />
            Checking...
          </Badge>
        ) : healthStatus?.ok ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
            <CheckCircle className="size-3 mr-1" />
            Connected
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
            <AlertCircle className="size-3 mr-1" />
            Offline
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={checkHealth}
          disabled={isCheckingHealth}
          className="h-7 px-2"
        >
          <RotateCcw className={cn("size-3", isCheckingHealth && "animate-spin")} />
        </Button>
      </div>

      {/* Health Status Message */}
      {healthStatus && (
        <div className={cn(
          'p-2.5 rounded-lg text-xs',
          healthStatus.ok
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        )}>
          <div className="flex items-center gap-1.5 mb-1">
            <ProviderIcon className="size-3" />
            <span className="font-medium capitalize">
              {healthStatus.provider ? PROVIDER_NAMES[healthStatus.provider] : 'Backend'}
            </span>
          </div>
          {healthStatus.message}
          {healthStatus.availableModels && healthStatus.availableModels.length > 0 && (
            <div className="mt-1 text-gray-600">
              Available: {healthStatus.availableModels.slice(0, 3).join(', ')}
              {healthStatus.availableModels.length > 3 && ` +${healthStatus.availableModels.length - 3} more`}
            </div>
          )}
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bot className="size-3.5 text-purple-500" />
            <span className="text-sm font-medium">Model</span>
          </div>
        </div>
        <Select
          value={settings.model}
          onValueChange={(value) => updateSetting('model', value)}
          disabled={availableModels.length === 0 && settings.provider === 'ollama'}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={availableModels.length === 0 && settings.provider === 'ollama' ? 'Loading models...' : 'Select a model'} />
          </SelectTrigger>
          <SelectContent>
            {settings.provider === 'groq' ? (
              <SelectItem value={GROQ_MODEL}>{GROQ_MODEL}</SelectItem>
            ) : (
              availableModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          {settings.provider === 'groq'
            ? `Using ${GROQ_MODEL} for AI-powered features.`
            : availableModels.length === 0
              ? 'Connect to Ollama to see available models.'
              : `Using ${settings.model} for hint generation.`}
        </p>
      </div>

      {/* Temperature Setting */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Thermometer className="size-3.5 text-orange-500" />
            <span className="text-sm font-medium">Temperature</span>
          </div>
          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
            {settings.temperature.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[settings.temperature]}
          onValueChange={([value]) => updateSetting('temperature', value)}
          min={0}
          max={2}
          step={0.1}
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          Lower = more focused hints. Higher = more creative variations.
        </p>
      </div>

      {/* Top-P Setting */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cpu className="size-3.5 text-blue-500" />
            <span className="text-sm font-medium">Top-P</span>
          </div>
          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
            {settings.topP.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[settings.topP]}
          onValueChange={([value]) => updateSetting('topP', value)}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          Controls diversity of token selection. Usually keep at 1.0.
        </p>
      </div>

      {/* Timeout Setting */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-gray-500" />
            <span className="text-sm font-medium">Timeout</span>
          </div>
          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
            {formatTimeout(settings.timeoutMs)}
          </span>
        </div>
        <Slider
          value={[settings.timeoutMs]}
          onValueChange={([value]) => updateSetting('timeoutMs', Math.round(value))}
          min={5000}
          max={60000}
          step={5000}
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          Maximum time to wait for LLM response. Increase for slower machines.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={saveSettings}
          disabled={!hasChanges}
          size="sm"
          className="flex-1"
        >
          {saveStatus === 'saved' ? (
            <>
              <CheckCircle className="size-4 mr-1.5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="size-4 mr-1.5" />
              Save Settings
            </>
          )}
        </Button>
        <Button
          onClick={resetSettings}
          variant="outline"
          size="sm"
        >
          <RotateCcw className="size-4 mr-1.5" />
          Reset
        </Button>
      </div>

      {/* Hint Preview */}
      <div className="pt-2 border-t">
        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
          <Sparkles className="size-3.5 text-amber-500" />
          <span className="font-medium">Preview Effect</span>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5">
          {settings.temperature < 0.3 ? (
            <>
              <p className="text-green-700 font-medium">🎯 Precise Mode</p>
              <p className="text-gray-600">Hints will be consistent and focused on the most likely correct answers.</p>
            </>
          ) : settings.temperature < 0.7 ? (
            <>
              <p className="text-blue-700 font-medium">⚖️ Balanced Mode</p>
              <p className="text-gray-600">Hints will have slight variations while maintaining accuracy.</p>
            </>
          ) : (
            <>
              <p className="text-purple-700 font-medium">🎨 Creative Mode</p>
              <p className="text-gray-600">Hints may explore alternative explanations and approaches.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to use LLM settings in other components
export function useLLMSettings() {
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      } catch {
        // Ignore parse errors
      }
    };

    loadSettings();

    // Listen for settings changes
    const handleSettingsChanged = (e: CustomEvent<LLMSettings>) => {
      setSettings(e.detail);
    };

    window.addEventListener('llm-settings-changed', handleSettingsChanged as EventListener);
    return () => {
      window.removeEventListener('llm-settings-changed', handleSettingsChanged as EventListener);
    };
  }, []);

  return settings;
}
