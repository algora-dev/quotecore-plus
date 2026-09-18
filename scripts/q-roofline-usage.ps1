$q = "select count(*) as total from supplier_tool_outputs;"
$b = @{ query = $q } | ConvertTo-Json
$headers = @{ Authorization = "Bearer " + $env:SUPABASE_ACCESS_TOKEN }
try {
  $r = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query" -Headers $headers -ContentType "application/json" -Body $b
  Write-Output ("TOTAL_ROWS=" + ($r | ConvertTo-Json -Compress))
} catch {
  Write-Output "QUERY_FAILED"
  if ($_.ErrorDetails) { Write-Output $_.ErrorDetails.Message } else { Write-Output $_.Exception.Message }
}
