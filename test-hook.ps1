git config --add core.hooksPath .git/hooks
git config --list | grep hook
Write-Host "`nCreating test file...`n"
Set-Content -Path "secret-test.txt" -Value "API_KEY=test123"
git add secret-test.txt
git commit -m "test: simple secret" 2>&1