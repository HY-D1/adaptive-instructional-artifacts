import { useEffect, useState, type ComponentType } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const ENABLE_SPEED_INSIGHTS = import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS !== 'false';
const ENABLE_ANALYTICS = import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true';
const ANALYTICS_MODULE_ID = '@vercel/analytics/react';

export function VercelTelemetry() {
  const [AnalyticsComponent, setAnalyticsComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!ENABLE_ANALYTICS) return;

    let active = true;
    const loadAnalytics = async () => {
      try {
        const mod = await import(/* @vite-ignore */ ANALYTICS_MODULE_ID) as {
          Analytics?: ComponentType;
        };
        if (active && mod.Analytics) {
          setAnalyticsComponent(() => mod.Analytics ?? null);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[telemetry] @vercel/analytics/react unavailable:', error);
        }
      }
    };

    void loadAnalytics();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {ENABLE_SPEED_INSIGHTS ? <SpeedInsights /> : null}
      {AnalyticsComponent ? <AnalyticsComponent /> : null}
    </>
  );
}
