# P2 preflight (read-only) against the shared Supabase project. Sanitized output.
$ErrorActionPreference = 'Stop'
$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) { $token = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', 'User') }
if (-not $token) { throw 'SUPABASE_ACCESS_TOKEN not found' }
$hdr = @{ Authorization = "Bearer $token" }
$uri = 'https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query'
$sql = [IO.File]::ReadAllText('C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-plus\tools\billing-p2\preflight.sql')
$body = @{ query = $sql } | ConvertTo-Json -Compress
$ok = $false
for ($i = 1; $i -le 3 -and -not $ok; $i++) {
  try {
    $raw = Invoke-RestMethod -Method Post -Uri $uri -Headers $hdr -Body $body -ContentType 'application/json' -ErrorAction Stop
    $raw | ConvertTo-Json -Depth 6 -Compress | Out-File -FilePath 'C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-plus\p2-preflight.json' -Encoding utf8
    Write-Output 'PREFLIGHT OK - saved p2-preflight.json'
    $ok = $true
  } catch {
    if ($i -eq 3) { throw }
    Start-Sleep -Seconds (2 * $i)
  }
}
