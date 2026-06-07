import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface PredictionStatus {
  replicateId: string;
  nodeId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';
  outputUrl?: string;
  storageUrl?: string;
  error?: string;
  completedAt?: string;
}

export type PredictionCallback = (status: PredictionStatus) => void;

export class PredictionRealtimeService {
  private channel: RealtimeChannel | null = null;
  private callbacks: Map<string, PredictionCallback> = new Map();
  private isSubscribed = false;

  /**
   * Subscribe to prediction updates for a specific user
   */
  subscribe(userId: string, onPredictionUpdate: PredictionCallback): void {
    if (this.isSubscribed) {
      console.log('[PredictionRealtime] Already subscribed');
      return;
    }

    console.log('[PredictionRealtime] Subscribing for user:', userId);

    this.channel = supabase
      .channel(`predictions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'replicate_predictions',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          this.handlePredictionChange(payload, onPredictionUpdate);
        }
      )
      .subscribe((status) => {
        console.log('[PredictionRealtime] Subscription status:', status);
        this.isSubscribed = status === 'SUBSCRIBED';
      });
  }

  /**
   * Subscribe to a specific prediction
   */
  subscribeToPrediction(
    predictionId: string,
    _nodeId: string,
    callback: PredictionCallback
  ): void {
    console.log('[PredictionRealtime] Subscribing to prediction:', predictionId);
    
    this.callbacks.set(predictionId, callback);

    // If not already subscribed to the channel, create one
    if (!this.channel) {
      this.channel = supabase
        .channel(`prediction-${predictionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'replicate_predictions',
            filter: `replicate_id=eq.${predictionId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const status = this.parsePayload(payload.new);
            callback(status);
          }
        )
        .subscribe((status) => {
          console.log('[PredictionRealtime] Prediction subscription:', status);
        });
    }
  }

  /**
   * Unsubscribe from all predictions
   */
  unsubscribe(): void {
    console.log('[PredictionRealtime] Unsubscribing');
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.callbacks.clear();
    this.isSubscribed = false;
  }

  /**
   * Unsubscribe from a specific prediction
   */
  unsubscribeFromPrediction(predictionId: string): void {
    this.callbacks.delete(predictionId);
  }

  private handlePredictionChange(
    payload: RealtimePostgresChangesPayload<any>,
    callback: PredictionCallback
  ): void {
    const status = this.parsePayload(payload.new);
    
    console.log('[PredictionRealtime] Prediction update:', {
      id: status.replicateId,
      nodeId: status.nodeId,
      status: status.status,
    });

    callback(status);

    // Also call specific callback if registered
    const specificCallback = this.callbacks.get(status.replicateId);
    if (specificCallback) {
      specificCallback(status);
    }
  }

  private parsePayload(data: any): PredictionStatus {
    return {
      replicateId: data.replicate_id,
      nodeId: data.node_id,
      status: data.status,
      outputUrl: data.output_url,
      storageUrl: data.storage_url,
      error: data.error,
      completedAt: data.completed_at,
    };
  }
}

// Create Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Singleton instance
export const predictionRealtime = new PredictionRealtimeService();
