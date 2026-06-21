import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase/supabaseClient';
import { logger } from '../../utils/logger';

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
  private predictionChannels: Map<string, RealtimeChannel> = new Map();
  private callbacks: Map<string, PredictionCallback> = new Map();

  /**
   * Subscribe to prediction updates for a specific user
   */
  subscribe(userId: string, onPredictionUpdate: PredictionCallback): void {
    if (this.channel) {
      logger.log('[PredictionRealtime] Already subscribed');
      return;
    }

    logger.log('[PredictionRealtime] Subscribing for user:', userId);

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
        logger.log('[PredictionRealtime] Subscription status:', status);
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
    logger.log('[PredictionRealtime] Subscribing to prediction:', predictionId);
    
    this.callbacks.set(predictionId, callback);

    if (!this.predictionChannels.has(predictionId)) {
      const channel = supabase
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
          logger.log('[PredictionRealtime] Prediction subscription:', status);
        });
      this.predictionChannels.set(predictionId, channel);
    }
  }

  /**
   * Unsubscribe from all predictions
   */
  unsubscribe(): void {
    logger.log('[PredictionRealtime] Unsubscribing');
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    for (const chan of this.predictionChannels.values()) {
      supabase.removeChannel(chan);
    }
    this.predictionChannels.clear();
    this.callbacks.clear();
  }

  /**
   * Unsubscribe from a specific prediction
   */
  unsubscribeFromPrediction(predictionId: string): void {
    this.callbacks.delete(predictionId);
    const chan = this.predictionChannels.get(predictionId);
    if (chan) {
      supabase.removeChannel(chan);
      this.predictionChannels.delete(predictionId);
    }
  }

  private handlePredictionChange(
    payload: RealtimePostgresChangesPayload<any>,
    callback: PredictionCallback
  ): void {
    const status = this.parsePayload(payload.new);
    
    logger.log('[PredictionRealtime] Prediction update:', {
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

// Singleton instance
export const predictionRealtime = new PredictionRealtimeService();
