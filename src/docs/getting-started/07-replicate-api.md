# Connecting to Replicate API

Replicate provides the AI models that power Anarchy AI's image generation.

## What is Replicate?

[Replicate](https://replicate.com) is a cloud platform that runs open-source AI models:
- FLUX.1 (text-to-image)
- Stable Diffusion variants
- Image enhancement models
- Custom fine-tuned models

## Getting API Key

### Step 1: Create Replicate Account
1. Go to [replicate.com](https://replicate.com)
2. Click "Sign Up" (top right)
3. Choose sign-up method:
   - Email/password
   - GitHub
   - Google
4. Verify your account

### Step 2: Get API Token
1. Sign in to Replicate
2. Go to **Account** → **API Tokens**
3. Click **"Create API Token"**
4. Name it: "Anarchy AI"
5. Copy the token (starts with `r8_`)

⚠️ **Keep this token secret!** Don't share it or commit to code.

### Step 3: Add to Anarchy AI
1. Open Anarchy AI app
2. Go to **Settings → AI Models**
3. Paste token in "Replicate API Key" field
4. Click **"Test Connection"**
5. Save settings

## Understanding Billing

### How It Works
- You pay Replicate directly for API usage
- Anarchy AI doesn't markup API costs
- You control your spending on Replicate

### Pricing
| Model | Cost per generation |
|-------|-------------------|
| FLUX.1 [pro] | ~$0.04 |
| FLUX.1 [dev] | ~$0.02 |
| FLUX.1 [schnell] | ~$0.01 |
| Recraft v3 | ~$0.03 |

### Set Limits
On Replicate:
1. Go to **Billing**
2. Set **Monthly Spending Cap**
3. Add payment method
4. Get email alerts at thresholds

## Troubleshooting

### "Invalid API Token"
- Check token copied completely (no extra spaces)
- Verify token not expired
- Regenerate token at replicate.com
- Ensure token has "read" and "write" permissions

### "Insufficient Credits"
- Add payment method on Replicate
- Check spending cap isn't reached
- Verify billing address
- Contact Replicate support if persistent

### "Model Not Found"
- Model may be temporarily unavailable
- Check Replicate status page
- Try alternative model
- Wait and retry

### Slow Generation
- Check your internet connection
- Try different model (schnell is fastest)
- Lower resolution settings
- Replicate may be busy (try off-peak hours)

## Alternative Providers

If Replicate doesn't work for you:

### Stability AI
1. Get API key from [platform.stability.ai](https://platform.stability.ai)
2. Enter in Settings → Alternative Providers
3. Select Stability AI as default

### OpenAI (DALL-E)
1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Higher cost but different style
3. Enter in Settings → Alternative Providers

### Local Models (Advanced)
- Run models on your own GPU
- No API costs
- Requires powerful hardware
- See Advanced Topics for setup

## Best Practices

### Security
- Never commit API keys to git
- Use environment variables
- Rotate keys periodically
- Monitor usage for anomalies

### Cost Control
- Start with cheaper models (schnell)
- Use lower steps for drafts (20-30)
- Generate at lower resolution, upscale later
- Set billing alerts

### Performance
- Keep default model for consistency
- Cache similar prompts
- Use history to avoid regenerating
- Batch process when possible

## API Status

Check current status:
- [Replicate Status](https://replicate.statuspage.io)
- In-app indicator (green = good, yellow = slow, red = down)

## Getting Help

Replicate Support:
- Discord: [replicate.com/discord](https://replicate.com/discord)
- Email: support@replicate.com
- Docs: [replicate.com/docs](https://replicate.com/docs)

Anarchy AI Support:
- Settings → Help → Report Issue
- Include API error messages

---

**Next**: Browse other documentation categories from the help menu.
