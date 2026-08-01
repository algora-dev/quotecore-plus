$token = $env:SUPABASE_ACCESS_TOKEN
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$sql = [IO.File]::ReadAllText("C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-plus\supabase\migrations\20260801130000_supplier_location_ranking.sql")
$body = @{ query = $sql } | ConvertTo-Json -Depth 3
$resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query" -Method POST -Body $body -Headers $headers
$resp | ConvertTo-Json -Depth 3
