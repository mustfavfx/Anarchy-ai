# Deploy replicate_webhook to Supabase
# Run this in PowerShell

$projectRef = "ejzsblxopqmhpjuqmzsxd"

Write-Host "🔧 Deploying replicate_webhook function..." -ForegroundColor Green

# Login to Supabase (if not already logged in)
npx supabase login

# Link project
npx supabase link --project-ref $projectRef

# Deploy the function
npx supabase functions deploy replicate_webhook

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to Supabase Dashboard → Edge Functions" -ForegroundColor Cyan
Write-Host "2. Click on 'Secrets' in the left menu" -ForegroundColor Cyan
Write-Host "3. Add these secrets:" -ForegroundColor Cyan
Write-Host "   - SUPABASE_URL: https://$projectRef.supabase.co" -ForegroundColor White
Write-Host "   - SUPABASE_SERVICE_ROLE_KEY: (from Project Settings → API)" -ForegroundColor White
Write-Host "   - REPLICATE_WEBHOOK_SIGNING_KEY: (from https://replicate.com/account/webhooks)" -ForegroundColor White
