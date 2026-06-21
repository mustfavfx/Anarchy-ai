import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockChannel: any = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockImplementation((cb) => {
    if (cb) cb('SUBSCRIBED');
    return mockChannel;
  }),
};

vi.mock('../supabase/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
  isSupabaseConfigured: true,
}));

import { supabase } from '../supabase/supabaseClient';
import { predictionRealtime } from './predictionRealtime';

describe('PredictionRealtimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    predictionRealtime.unsubscribe();
    mockChannel.on.mockReturnValue(mockChannel);
    mockChannel.subscribe.mockImplementation((cb: any) => {
      if (cb) cb('SUBSCRIBED');
      return mockChannel;
    });
  });

  it('should subscribe to postgres changes for user updates', () => {
    const callback = vi.fn();
    let changeHandler: any = null;

    mockChannel.on.mockImplementation((type: string, _config: any, handler: any) => {
      if (type === 'postgres_changes') {
        changeHandler = handler;
      }
      return mockChannel;
    });

    predictionRealtime.subscribe('user-123', callback);

    expect(supabase.channel).toHaveBeenCalledWith('predictions-user-123');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'replicate_predictions',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();

    // Trigger update
    const payload = {
      new: {
        replicate_id: 'rep-456',
        node_id: 'node-789',
        status: 'completed',
        output_url: 'http://output.url',
        storage_url: 'http://storage.url',
        error: undefined,
        completed_at: '2024-01-01T00:00:00Z',
      },
    };

    expect(changeHandler).toBeTypeOf('function');
    changeHandler(payload);

    expect(callback).toHaveBeenCalledWith({
      replicateId: 'rep-456',
      nodeId: 'node-789',
      status: 'completed',
      outputUrl: 'http://output.url',
      storageUrl: 'http://storage.url',
      error: undefined,
      completedAt: '2024-01-01T00:00:00Z',
    });
  });

  it('should subscribe to updates for a specific prediction ID', () => {
    const callback = vi.fn();
    let changeHandler: any = null;

    mockChannel.on.mockImplementation((type: string, _config: any, handler: any) => {
      if (type === 'postgres_changes') {
        changeHandler = handler;
      }
      return mockChannel;
    });

    predictionRealtime.subscribeToPrediction('rep-abc', 'node-xyz', callback);

    expect(supabase.channel).toHaveBeenCalledWith('prediction-rep-abc');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'replicate_predictions',
        filter: 'replicate_id=eq.rep-abc',
      },
      expect.any(Function)
    );

    // Trigger update payload
    const payload = {
      new: {
        replicate_id: 'rep-abc',
        node_id: 'node-xyz',
        status: 'processing',
      },
    };

    changeHandler(payload);

    expect(callback).toHaveBeenCalledWith({
      replicateId: 'rep-abc',
      nodeId: 'node-xyz',
      status: 'processing',
      outputUrl: undefined,
      storageUrl: undefined,
      error: undefined,
      completedAt: undefined,
    });
  });

  it('should unsubscribe and remove the channel', () => {
    // Subscribe first to create the channel
    predictionRealtime.subscribe('user-123', vi.fn());
    expect(supabase.channel).toHaveBeenCalled();

    predictionRealtime.unsubscribe();

    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('should unsubscribe from a specific prediction', () => {
    const callback = vi.fn();
    predictionRealtime.subscribeToPrediction('rep-id', 'node-id', callback);
    predictionRealtime.unsubscribeFromPrediction('rep-id');
    // Verify it doesn't run callback when update dispatched after unsubscribe
  });
});
