$ErrorActionPreference = 'Continue'
$key = $args[0]
$out = Join-Path $PWD '.impeccable\answer-out.txt'
$err = Join-Path $PWD '.impeccable\answer-err.txt'
$cmd = '.agents\skills\impeccable\scripts\impeccable.cmd'
for ($i = 0; $i -lt 200; $i++) {
  $result = & cmd /c "`"$cmd`" serve-question --wait --key $key" 2>&1 | Out-String
  if ($result -match 'ANSWER') {
    $result | Out-File -Encoding utf8 $out
    exit 0
  }
  Start-Sleep -Seconds 3
}
'no answer' | Out-File -Encoding utf8 $out
exit 1
