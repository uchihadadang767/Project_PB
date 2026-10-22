param(
    [Parameter(Mandatory=$true)]
    [string]$ImagePath,
    [string]$PrinterName = ""
)

try {
    Add-Type -AssemblyName System.Drawing

    if (-not (Test-Path $ImagePath)) {
        Write-Error "Image file not found: $ImagePath"
        exit 1
    }

    $resolvedPath = (Resolve-Path $ImagePath).Path
    $doc = New-Object System.Drawing.Printing.PrintDocument

    if ($PrinterName -and $PrinterName.Trim() -ne "") {
        $doc.PrinterSettings.PrinterName = $PrinterName
    }

    if (-not $doc.PrinterSettings.IsValid) {
        Write-Warning "Target printer '$PrinterName' is not valid. Falling back to default printer: $($doc.PrinterSettings.PrinterName)"
    }

    # Zero margins for thermal receipt roll
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $doc.OriginAtMargins = $true

    $img = [System.Drawing.Image]::FromFile($resolvedPath)

    $doc.add_PrintPage({
        param($sender, $ev)
        
        # Calculate fit to roll width
        $pageWidth = $ev.PageBounds.Width
        if ($pageWidth -le 0) { $pageWidth = 280 }
        
        $scale = $pageWidth / $img.Width
        $renderHeight = [int]($img.Height * $scale)

        $ev.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $ev.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $ev.Graphics.DrawImage($img, 0, 0, $pageWidth, $renderHeight)
        $ev.HasMorePages = $false
    })

    $doc.Print()
    $img.Dispose()
    $doc.Dispose()

    Write-Output "SUCCESS: Printed to $($doc.PrinterSettings.PrinterName)"
    exit 0
} catch {
    Write-Error "PRINT_ERROR: $($_.Exception.Message)"
    exit 1
}
