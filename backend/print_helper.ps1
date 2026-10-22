param(
    [Parameter(Mandatory=$false)]
    [string]$ImagePath = "",
    [string]$PrinterName = "",
    [switch]$TestFeed
)

$code = @'
using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class RawThermalPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendRawBytes(string szPrinterName, byte[] bytes) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Thermal Photobooth Strip";
        di.pDataType = "RAW";

        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    int written = 0;
                    bool ok = WritePrinter(hPrinter, pBytes, bytes.Length, out written);
                    Marshal.FreeCoTaskMem(pBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return ok;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }

    public static byte[] GenerateTestTicket(string printerName) {
        using (MemoryStream ms = new MemoryStream()) {
            // ESC @ (Init)
            ms.Write(new byte[] { 0x1B, 0x40 }, 0, 2);
            // ESC a 1 (Center align)
            ms.Write(new byte[] { 0x1B, 0x61, 0x01 }, 0, 3);
            // Double height ESC ! 0x10
            ms.Write(new byte[] { 0x1B, 0x21, 0x10 }, 0, 3);
            byte[] title = Encoding.ASCII.GetBytes("PHOTOBOOTH KIOSK\n");
            ms.Write(title, 0, title.Length);
            // Normal ESC ! 0x00
            ms.Write(new byte[] { 0x1B, 0x21, 0x00 }, 0, 3);
            byte[] sub = Encoding.ASCII.GetBytes("--- THERMAL PRINTER TEST ---\n\n");
            ms.Write(sub, 0, sub.Length);
            // ESC a 0 (Left align)
            ms.Write(new byte[] { 0x1B, 0x61, 0x00 }, 0, 3);
            string body = "Status  : HARDWARE ONLINE [OK]\nPrinter : " + printerName + "\nDate    : " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\nCutter  : TEST SUCCESS\n\n================================\n\n";
            byte[] bodyBytes = Encoding.ASCII.GetBytes(body);
            ms.Write(bodyBytes, 0, bodyBytes.Length);
            // Feed 4 lines (ESC d 4)
            ms.Write(new byte[] { 0x1B, 0x64, 0x04 }, 0, 3);
            // Cut (GS V 0)
            ms.Write(new byte[] { 0x1D, 0x56, 0x00 }, 0, 3);
            return ms.ToArray();
        }
    }

    public static byte[] ConvertImageToEscPos(string imagePath, int targetWidth) {
        using (Bitmap src = new Bitmap(imagePath)) {
            int width = targetWidth;
            int height = (int)((float)src.Height * targetWidth / src.Width);

            using (Bitmap bmp = new Bitmap(width, height)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.DrawImage(src, 0, 0, width, height);
                }

                int widthBytes = (width + 7) / 8;
                using (MemoryStream ms = new MemoryStream()) {
                    // ESC @ (Init)
                    ms.Write(new byte[] { 0x1B, 0x40 }, 0, 2);

                    // GS v 0 0 xL xH yL yH
                    byte xL = (byte)(widthBytes & 0xFF);
                    byte xH = (byte)((widthBytes >> 8) & 0xFF);
                    byte yL = (byte)(height & 0xFF);
                    byte yH = (byte)((height >> 8) & 0xFF);

                    ms.Write(new byte[] { 0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH }, 0, 8);

                    for (int y = 0; y < height; y++) {
                        for (int x = 0; x < widthBytes; x++) {
                            byte b = 0;
                            for (int bit = 0; bit < 8; bit++) {
                                int px = x * 8 + bit;
                                if (px < width) {
                                    Color c = bmp.GetPixel(px, y);
                                    int luminance = (int)(c.R * 0.299 + c.G * 0.587 + c.B * 0.114);
                                    if (luminance < 140) {
                                        b |= (byte)(1 << (7 - bit));
                                    }
                                }
                            }
                            ms.WriteByte(b);
                        }
                    }

                    // Feed 4 lines
                    ms.Write(new byte[] { 0x1B, 0x64, 0x04 }, 0, 3);

                    // Cut paper (GS V 0)
                    ms.Write(new byte[] { 0x1D, 0x56, 0x00 }, 0, 3);

                    return ms.ToArray();
                }
            }
        }
    }
}
'@

try {
    Add-Type -AssemblyName System.Drawing
    if (-not ([System.Management.Automation.PSTypeName]'RawThermalPrinter').Type) {
        Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
    }

    # Target printer priority:
    # 1. Parameter PrinterName if given and valid
    # 2. 'Thermal Printer' (created on USB004) if exists
    # 3. Default printer
    $targetPrinter = $PrinterName
    $installed = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters

    if (-not $targetPrinter -or $targetPrinter.Trim() -eq "") {
        if ($installed -contains "Thermal Printer") {
            $targetPrinter = "Thermal Printer"
        } else {
            $targetPrinter = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName
        }
    }

    Write-Host "[PRINT-HELPER] Target Printer: $targetPrinter"

    # If TestFeed requested, send test ticket immediately
    if ($TestFeed) {
        $testBytes = [RawThermalPrinter]::GenerateTestTicket($targetPrinter)
        $rawSuccess = [RawThermalPrinter]::SendRawBytes($targetPrinter, $testBytes)
        if ($rawSuccess) {
            Write-Output "SUCCESS_TEST: Test ticket printed to $targetPrinter"
            exit 0
        } else {
            Write-Error "RAW_PRINT_FAILED: Failed to send test ticket to $targetPrinter"
            exit 1
        }
    }

    if (-not (Test-Path $ImagePath)) {
        Write-Error "Image file not found: $ImagePath"
        exit 1
    }

    $resolvedPath = (Resolve-Path $ImagePath).Path

    # Step 1: Attempt direct RAW ESC/POS printing (Fastest, zero margin, direct head raster)
    try {
        $escposBytes = [RawThermalPrinter]::ConvertImageToEscPos($resolvedPath, 576)
        $rawSuccess = [RawThermalPrinter]::SendRawBytes($targetPrinter, $escposBytes)
        if ($rawSuccess) {
            Write-Output "SUCCESS_RAW: Printed ESC/POS bitmap to $targetPrinter"
            exit 0
        } else {
            Write-Warning "RAW print spooling returned false, trying GDI PrintDocument fallback..."
        }
    } catch {
        Write-Warning "RAW ESC/POS error: $($_.Exception.Message). Falling back to GDI..."
    }

    # Step 2: Fallback to GDI PrintDocument (for standard inkjet/laser/virtual printer)
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $targetPrinter
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $doc.OriginAtMargins = $true

    $img = [System.Drawing.Image]::FromFile($resolvedPath)
    $doc.add_PrintPage({
        param($sender, $ev)
        $pageW = $ev.PageBounds.Width
        if ($pageW -le 0) { $pageW = 280 }
        $scale = $pageW / $img.Width
        $renderH = [int]($img.Height * $scale)
        $ev.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $ev.Graphics.DrawImage($img, 0, 0, $pageW, $renderH)
        $ev.HasMorePages = $false
    })

    $doc.Print()
    $img.Dispose()
    $doc.Dispose()

    Write-Output "SUCCESS_GDI: Printed to $targetPrinter"
    exit 0
} catch {
    Write-Error "PRINT_ERROR: $($_.Exception.Message)"
    exit 1
}
