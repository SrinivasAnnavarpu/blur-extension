$p = "C:\Users\manas\.openclaw\workspace\claw-redactor\src\editor\editor.tsx"
$c = Get-Content $p -Raw
# Remove the full-screen overlay div (it blocks mouse events on boxes)
$pattern = '(?s)\r?\n\s*<div\r?\n\s*onMouseMove=\{\(e\) => \{.*?\}\}\r?\n\s*/>\r?\n'
$c2 = [regex]::Replace($c, $pattern, "`n")
Set-Content -Path $p -Value $c2 -NoNewline
Write-Output "patched $p"
