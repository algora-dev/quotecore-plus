$q = "select u.email, u.full_name, c.name as company, c.comp_until from companies c join users u on u.company_id = c.id and u.role = 'owner' where c.comp_until is not null order by c.comp_until desc;"
$b = @{ query = $q } | ConvertTo-Json
$headers = @{ Authorization = "Bearer " + $env:SUPABASE_ACCESS_TOKEN }
try {
  $r = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query" -Headers $headers -ContentType "application/json" -Body $b
  Write-Output "QUERY_OK"
  $r | ConvertTo-Json -Depth 3
} catch {
  Write-Output "QUERY_FAILED"
  if ($_.ErrorDetails) { Write-Output $_.ErrorDetails.Message } else { Write-Output $_.Exception.Message }
}
