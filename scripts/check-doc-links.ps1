# Walk every MDX file and check that every internal /docs/* link resolves
# to a known slug. Prints any broken links and exits non-zero if any are found.

$root = "$PSScriptRoot\..\content\docs"

# Collect known slugs.
$known = @()
$known += ""  # index
Get-ChildItem -Recurse -Path $root -Filter *.mdx | ForEach-Object {
    $rel = $_.FullName.Substring((Resolve-Path $root).Path.Length + 1) -replace '\\', '/'
    if ($rel -eq "index.mdx") { return }
    $slug = $rel -replace '\.mdx$', ''
    $known += $slug
}

$knownSet = @{}
foreach ($s in $known) { $knownSet[$s] = $true }

$broken = @()

Get-ChildItem -Recurse -Path $root -Filter *.mdx | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    # Match /docs/<slug> in markdown links and bare anywhere.
    $matches = [System.Text.RegularExpressions.Regex]::Matches($content, '/docs/([a-z0-9\-/]+)?')
    foreach ($m in $matches) {
        $slug = if ($m.Groups[1].Success) { $m.Groups[1].Value.TrimEnd('/') } else { "" }
        if (-not $knownSet.ContainsKey($slug)) {
            $broken += [pscustomobject]@{
                File = $_.FullName.Substring((Resolve-Path $root).Path.Length + 1)
                Slug = $slug
                Match = $m.Value
            }
        }
    }
}

if ($broken.Count -eq 0) {
    Write-Host "All internal /docs links resolve."
    exit 0
} else {
    Write-Host "Broken links found:"
    $broken | Format-Table -AutoSize
    exit 1
}
