import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';

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
  userId?: string | null;
  properties?: Record<string, string | number | boolean | null>;
}

const APP_VERSION = '0.7.0';

// Queue events while offline, flush on reconnect
const queue: TrackPayload[] = [];
let flushing = false;

async function flushQueue() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, 20);
  try {
    await supabase.from('usage_events').insert(
      batch.map(p => ({
        user_id: p.userId ?? null,
        event: p.event,
        properties: p.properties ?? {},
        app_version: APP_VERSION,
        ts: new Date().toISOString(),
      }))
    );
  } catch {
    queue.unshift(...batch);
  } finally {
    flushing = false;
  }
}

export async function track(payload: TrackPayload): Promise<void> {
  if (!isSupabaseConfigured) return;
  queue.push(payload);
  await flushQueue();
}
