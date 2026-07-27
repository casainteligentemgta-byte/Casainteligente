param([string]$InputPath, [string]$OutputPath, [uint32]$MaxSide = 1600)
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod -eq $true
})[0]
function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
function AwaitAction($WinRtAction) {
  $asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod }
  foreach ($m in $asTaskMethods) {
    try {
      $netTask = $m.Invoke($null, @($WinRtAction))
      if ($null -ne $netTask) { $netTask.Wait(-1) | Out-Null; return }
    } catch {}
  }
  # IAsyncOperation<uint> for LoadAsync
  $opType = $WinRtAction.GetType()
  $asOp = $asTaskGeneric.MakeGenericMethod([uint32])
  try {
    $netTask = $asOp.Invoke($null, @($WinRtAction))
    $netTask.Wait(-1) | Out-Null
    return
  } catch {}
  throw "Cannot await $($WinRtAction.GetType().FullName)"
}

$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime]

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($InputPath)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$w = [uint32]$decoder.PixelWidth; $h = [uint32]$decoder.PixelHeight
$scale = 1.0
$maxDim = [Math]::Max($w, $h)
if ($maxDim -gt $MaxSide) { $scale = $MaxSide / $maxDim }
$tw = [uint32][Math]::Max(1, [Math]::Round($w * $scale))
$th = [uint32][Math]::Max(1, [Math]::Round($h * $scale))
$transform = [Windows.Graphics.Imaging.BitmapTransform]::new()
$transform.ScaledWidth = $tw
$transform.ScaledHeight = $th
$transform.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
$soft = Await ($decoder.GetSoftwareBitmapAsync(
  [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
  [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore,
  $transform,
  [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,
  [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage
)) ([Windows.Graphics.Imaging.SoftwareBitmap])

# Write JPEG to a StorageFile directly (more reliable)
$outFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((New-Item -ItemType File -Path $OutputPath -Force).FullName)) ([Windows.Storage.StorageFile])
# Create empty first then reopen write
if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }
[System.IO.File]::WriteAllBytes($OutputPath, [byte[]]@(0))
$outFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($OutputPath)) ([Windows.Storage.StorageFile])
$outStream = Await ($outFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])
$encoder = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync(
  [Windows.Graphics.Imaging.BitmapEncoder]::JpegEncoderId, $outStream)) ([Windows.Graphics.Imaging.BitmapEncoder])
$encoder.SetSoftwareBitmap($soft)
AwaitAction ($encoder.FlushAsync())
$outStream.Dispose()
$stream.Dispose()
$len = (Get-Item -LiteralPath $OutputPath).Length
Write-Output ("OK {0} {1}x{2} {3}" -f (Split-Path $OutputPath -Leaf), $tw, $th, $len)
