$ErrorActionPreference = 'Stop'
# Chon file khoa JSON cua tai khoan may Google (service account), dat vao secret GDRIVE_SA_JSON cua web.
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = 'Chon file khoa .json cua tai khoan may Google'
$dlg.Filter = 'Khoa Google (*.json)|*.json'
$dlg.InitialDirectory = Join-Path $env:USERPROFILE 'Downloads'
if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { throw 'Chua chon file' }
$path = $dlg.FileName
$k = Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json
if ($k.type -ne 'service_account' -or -not $k.client_email -or -not $k.private_key) { throw 'File nay khong phai khoa tai khoan may Google (service account)' }
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
# Gui qua stdin, khong hien tren man hinh, khong ghi them file nao.
($k | ConvertTo-Json -Compress -Depth 5) | npx wrangler secret put GDRIVE_SA_JSON --env production
if ($LASTEXITCODE -ne 0) { throw 'Khong dat duoc khoa vao web' }
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path, 'OnlyErrorDialogs', 'SendToRecycleBin')
Write-Host ''
Write-Host ('Email tai khoan may (chia se thu muc cho email nay, quyen Nguoi xem): ' + $k.client_email)
