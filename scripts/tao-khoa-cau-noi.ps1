$ErrorActionPreference = 'Stop'
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = 'rly_' + (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
# Dat khoa vao secret cua web (qua stdin, khong hien tren man hinh, khong ghi file).
$key | npx wrangler secret put AGENT_RELAY_KEY --env production
if ($LASTEXITCODE -ne 0) { throw 'Khong dat duoc khoa vao web' }
Set-Clipboard -Value $key
