# Replicate Webhook Setup Guide

## Overview
This guide explains how to set up the Replicate webhook for async image generation with secure signature verification.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   User      │────▶│  Frontend    │────▶│  Replicate API  │
│  Generate   │     │  generate()  │     │  (async + hook) │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                   │
                              ┌────────────────────┘
                              │ Webhook + Signature
                              ▼
                    ┌──────────────────┐
                    │  Supabase Edge   │
                    │  Function        │
                    │  (verify +       │
                    │   download +     │
                    │   upload)        │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Supabase        │
                    │  Storage         │
                    │  (permanent URL) │
                    └──────────────────┘
```

## Setup Steps

### 1. Deploy Edge Function

```bash
supabase functions deploy replicate-webhook
```

### 2. Set Webhook Signing Key Secret

Get your signing key from: https://replicate.com/account/webhooks

```bash
# Set the webhook signing key as a secret
supabase secrets set REPLICATE_WEBHOOK_SIGNING_KEY=whsec_your_key_here
```

**Important**: Keep this key secure! It verifies that requests are actually from Replicate.

### 3. Configure Replicate Webhook

In Replicate Dashboard:
1. Go to https://replicate.com/account/webhooks
2. Add webhook URL:
   ```
   https://your-project-ref.supabase.co/functions/v1/replicate-webhook
   ```
3. Select events:
   - `prediction.started` (optional)
   - `prediction.completed` (required)
   - `prediction.failed` (optional)

### 4. Create Storage Bucket

```bash
# Via Supabase CLI or Dashboard
supabase storage create generated-images --public
```

Or manually in Dashboard:
1. Storage > New Bucket
2. Name: `generated-images`
3. Public: ✅ Enabled
4. File size limit: 10MB

### 5. Run Database Migration

```bash
supabase db push
```

This creates:
- `replicate_predictions` table
- RLS policies
- Helper functions

### 6. Update Environment Variables

In your `.env` file:

```bash
# Replicate API Token
VITE_REPLICATE_API_TOKEN=your_replicate_token

# Supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Webhook URL (auto-constructed if not set)
VITE_REPLICATE_WEBHOOK_URL=https://your-project-ref.supabase.co/functions/v1/replicate-webhook
```

## How It Works

### 1. Initiate Generation

```typescript
// Frontend code
const { predictionId, status } = await replicateService.generateWithWebhook(
  {
    model: 'black-forest-labs/flux-1-dev',
    prompt: 'a beautiful sunset',
    // ... other params
  },
  {
    nodeId: 'node-123',
    userId: 'user-456',
    workflowId: 'workflow-789'
  }
);

// Store predictionId and show "Generating..." state
```

### 2. Replicate Processes
- Replicate generates the image
- When complete, sends webhook to your Edge Function
- Includes signature in `Replicate-Signature` header

### 3. Webhook Handler
1. **Verify Signature**: Ensures request is from Replicate
2. **Download Image**: Fetches from temporary Replicate URL
3. **Upload to Storage**: Saves to `generated-images` bucket
4. **Update Database**: Stores permanent URL in `replicate_predictions`

### 4. Frontend Updates
- Poll Supabase Realtime or query `replicate_predictions` table
- When `status = 'completed'`, display image from `storage_url`

## Security Features

### Webhook Signature Verification
- Uses HMAC-SHA256 with your signing key
- Prevents unauthorized requests
- Constant-time comparison prevents timing attacks

### RLS Policies
- Users can only see their own predictions
- Service role has full access for webhook

### Storage Policies
- Images organized by user: `user_id/node_id/prediction_id.ext`
- Public bucket allows direct image access
- File size limit: 10MB

## API Reference

### ReplicateService Methods

```typescript
// Synchronous generation (waits for result)
async generate(params: ReplicateGenerationParams): Promise<ReplicateGenerationResult>

// Asynchronous with webhook (returns immediately)
async generateWithWebhook(
  params: ReplicateGenerationParams,
  metadata: { nodeId: string; userId: string; workflowId?: string }
): Promise<{ predictionId: string; status: string }>
```

### Database Schema

```sql
replicate_predictions
├── replicate_id    TEXT (Replicate ID)
├── user_id         UUID
├── node_id         TEXT
├── status          TEXT (pending/processing/completed/failed)
├── output_url      TEXT (temporary Replicate URL)
├── storage_url     TEXT (permanent Supabase URL)
└── completed_at    TIMESTAMPTZ
```

## Troubleshooting

### "Invalid signature" Error
- Check `REPLICATE_WEBHOOK_SIGNING_KEY` is set correctly
- Ensure key matches the one in Replicate dashboard

### "Storage bucket not ready" Error
- Create `generated-images` bucket in Supabase Dashboard
- Or the function will auto-create it (requires permissions)

### "Prediction not found" Error
- Check metadata is being sent with prediction
- Verify `node_id` and `user_id` are included

### Images Not Displaying
- Check `storage_url` is populated in database
- Verify Storage bucket is public
- Check RLS policies allow reading

## Testing

### Test Webhook Locally

```bash
# Start Supabase locally
supabase start

# In another terminal, expose local function
npx ngrok http 54321

# Configure Replicate with ngrok URL
# https://replicate.com/account/webhooks
```

### Test Signature Verification

```bash
curl -X POST http://localhost:54321/functions/v1/replicate-webhook \
  -H "Content-Type: application/json" \
  -H "Replicate-Signature: sha256=invalid" \
  -d '{"test": "data"}'

# Should return 401 Unauthorized
```

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `REPLICATE_WEBHOOK_SIGNING_KEY` | ✅ Yes | Webhook signature verification |
| `SUPABASE_URL` | ✅ Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Service role for DB/Storage access |
| `VITE_REPLICATE_WEBHOOK_URL` | ❌ No | Auto-constructed if not set |

## Next Steps

1. ✅ Webhook setup complete
2. 🔄 Add Supabase Realtime for live updates
3. 🔄 Update GhostNode to show "Generating" state
4. 🔄 Add retry logic for failed uploads
