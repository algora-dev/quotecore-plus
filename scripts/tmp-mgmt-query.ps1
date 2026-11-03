param(
  [Parameter(Mandatory=$true)][string]$Sql
)
$tmp = New-TemporaryFile
@{ query = $Sql } | ConvertTo-Json -Compress | Out-File -FilePath $tmp -Encoding utf8
$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) { Write-Output "NO_TOKEN"; exit 1 }
curl.exe -s --max-time 40 -X POST "https://api.supabase.com/v1/projects/bcqrrrvbzlfmfgvotzqw/database/query" -H "Authorization: Bearer $token" -H "Content-Type: application/json" --data "@$tmp"
Remove-Item $tmp -Force
