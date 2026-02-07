$p = "C:\Users\manas\.openclaw\workspace\claw-redactor\src\editor\editor.tsx"
$c = Get-Content $p -Raw
# Remove the leftover sidebar block (Boxes list) if present
$pattern = '(?s)\r?\n\s*<div style=\{\{ border: "1px solid #e5e7eb".*?<\/div>\r?\n\s*<\/div>\r?\n\s*\)\}\r?\n\s*<\/div>\r?\n\s*\);\r?\n\}\r?\n$'
if ($c -match $pattern) {
  $c2 = [regex]::Replace($c, $pattern, "`n    </div>`n  );`n}`n")
  Set-Content -Path $p -Value $c2 -NoNewline
  Write-Output "sidebar removed"
} else {
  Write-Output "pattern not found; no changes"
}
