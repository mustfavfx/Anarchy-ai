# Deploy comet_webhook to Supabase
# Run this in PowerShell: .\DEPLOY_COMET_WEBHOOK.ps1

$projectRef = "ejzsbkxpqmhpjuqmszvd"

Write-Host "🔧 Deploying comet_webhook Edge Function to Supabase ($projectRef)..." -ForegroundColor Green

# Deploy the function with --no-verify-jwt (allows CometAPI callbacks without auth headers)
npx supabase functions deploy comet_webhook --no-verify-jwt --project-ref $projectRef

Write-Host "✅ comet_webhook deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Webhook URL:" -ForegroundColor Yellow
Write-Host "https://$projectRef.supabase.co/functions/v1/comet_webhook" -ForegroundColor Cyan
