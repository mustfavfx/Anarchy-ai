import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
import { useAuth } from '../../features/auth/AuthContext';

export type TrackEvent =
  | 'session_start'
  | 'image_generated'
  | 'image_upscaled'
  | 'video_generated'
  | 'model_changed'
  | 'node_deleted'
  | 'canvas_reset'
  | 'project_saved'
  | 'project_loaded'
  | 'plugin_installed'
  | 'page_viewed';

interface TrackPayload {
  event: TrackEvent;
  properties?: Record<string, string | number | boolean | null>;
}

export function useTracker() {
  const { user } = useAuth();

  const track = useCallback(async ({ event, properties }: TrackPayload) => {
    if (!isSupabaseConfigured) return;

    try {
      await supabase.from('usage_events').insert({
        user_id: user?.id ?? null,
        event,
        properties: properties ?? {},
        app_version: '0.7.0',
        ts: new Date().toISOString(),
      });
    } catch {
      // Silent — never break the app due to tracking
    }
  }, [user]);

  return { track };
}
