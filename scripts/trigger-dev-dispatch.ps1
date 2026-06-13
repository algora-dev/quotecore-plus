# trigger-dev-dispatch.ps1
# On-demand trigger for the scheduled-message dispatcher on the DEV deployment.
#
# WHY: the standing pg_cron job only targets PRODUCTION (app.quote-core.com) so
# we never leak/duplicate or accidentally promote a dev-targeted scheduler
# (Gerald audit C-01). When you're actively testing follow-ups on dev, run this
# to fire one dispatch sweep against the dev endpoint.
#
# AUTH: reads CRON_SECRET. Provide it via -Secret, or set $env:CRON_SECRET,
# or pull from Vercel:  vercel env pull .env.dev --environment=production
#
# USAGE:
#   ./scripts/trigger-dev-dispatch.ps1 -Secret "<CRON_SECRET>"
#   ./scripts/trigger-dev-dispatch.ps1                # uses $env:CRON_SECRET

param(
  [string]$Secret = $env:CRON_SECRET,
  [string]$Url = "https://quotecore-plus-dev.vercel.app/api/cron/dispatch-scheduled-messages"
)

if ([string]::IsNullOrWhiteSpace($Secret)) {
  Write-Error "No CRON_SECRET provided. Pass -Secret or set `$env:CRON_SECRET."
  exit 1
}

Write-Output "Triggering dev dispatch: $Url"
try {
  $r = Invoke-WebRequest -Uri $Url -Headers @{ Authorization = "Bearer $Secret" } -Method Get -TimeoutSec 30 -ErrorAction Stop
  Write-Output "STATUS: $($r.StatusCode)"
  Write-Output $r.Content
} catch {
  Write-Output "STATUS: $($_.Exception.Response.StatusCode.value__)"
  Write-Error $_.Exception.Message
  exit 1
}
