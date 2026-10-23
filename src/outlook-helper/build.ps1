$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$sourceFile = Join-Path $PSScriptRoot 'Program.cs'
$manifestFile = Join-Path $PSScriptRoot 'app.manifest'
$outputFile = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\public\outlook\DDE-Outlook.exe'))
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll /reference:System.Web.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll ('/win32manifest:' + $manifestFile) ('/out:' + $outputFile) $sourceFile
if ($LASTEXITCODE -ne 0) { throw 'A compilação do auxiliar falhou.' }
$check = Start-Process -FilePath $outputFile -ArgumentList '--self-test' -WindowStyle Hidden -PassThru -Wait
if ($check.ExitCode -ne 0) { throw 'O teste interno do auxiliar falhou.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $outputFile
