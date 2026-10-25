param(
    [Parameter(Mandatory=$false)]
    [string]$ImagePath = "",
    [string]$PrinterName = "",
    [string]$PaperWidth = "80mm",
    [switch]$NoCut,
    [switch]$TestFeed
)

$code = @'
using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public class RawComPrinter {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern SafeFileHandle CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile
    );

    public static bool SendRawBytes(string portName, byte[] bytes) {
        string fullPort = @"\\.\" + portName.TrimEnd(':');
        uint access = 0x40000000; // GENERIC_WRITE
        uint share = 0;
        uint openExisting = 3;

        SafeFileHandle handle = null;
        for (int i = 0; i < 6; i++) {
            handle = CreateFile(fullPort, access, share, IntPtr.Zero, openExisting, 0, IntPtr.Zero);
            if (!handle.IsInvalid) {
                break;
            }
            System.Threading.Thread.Sleep(350);
        }

        if (handle == null || handle.IsInvalid) {
            int err = Marshal.GetLastWin32Error();
            Console.WriteLine("[RawComPrinter] CreateFile failed for " + fullPort + " with Win32 error: " + err);
            return false;
        }

        try {
            using (FileStream fs = new FileStream(handle, FileAccess.Write)) {
                fs.Write(bytes, 0, bytes.Length);
                fs.Flush();
            }
            return true;
        } catch {
            return false;
        } finally {
            handle.Close();
        }
    }
}

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

    public static byte[] GenerateTestTicket(string printerName, bool isBluetooth, bool is58mm) {
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
            string subText = isBluetooth ? "--- BLUETOOTH WIRELESS TEST ---\n\n" : "--- THERMAL PRINTER TEST ---\n\n";
            byte[] sub = Encoding.ASCII.GetBytes(subText);
            ms.Write(sub, 0, sub.Length);
            // ESC a 0 (Left align)
            ms.Write(new byte[] { 0x1B, 0x61, 0x00 }, 0, 3);
            string conn = isBluetooth ? "BLUETOOTH WIRELESS (COM6)" : "USB CABLE (DIRECT)";
            string paper = is58mm ? "58MM (384 Dots)" : "80MM (576 Dots)";
            string body = "Status  : ONLINE & CONNECTED [OK]\nLink    : " + conn + "\nPrinter : " + printerName + "\nPaper   : " + paper + "\nDate    : " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\n\n================================\n";
            byte[] bodyBytes = Encoding.ASCII.GetBytes(body);
            ms.Write(bodyBytes, 0, bodyBytes.Length);
            
            // Feed lines
            ms.Write(new byte[] { 0x1B, 0x64, 0x04 }, 0, 3);

            if (!is58mm && !isBluetooth) {
                // Cut (GS V 0) for 80mm cutters
                ms.Write(new byte[] { 0x1D, 0x56, 0x00 }, 0, 3);
            } else {
                // Extra feed so manual tear bar clears
                ms.Write(new byte[] { 0x1B, 0x64, 0x02 }, 0, 3);
            }
            return ms.ToArray();
        }
    }

    public static byte[] ConvertImageToEscPos(string imagePath, int targetWidth, bool autoCut) {
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

                    if (autoCut) {
                        // Cut paper (GS V 0)
                        ms.Write(new byte[] { 0x1D, 0x56, 0x00 }, 0, 3);
                    } else {
                        // Extra feed for manual tear bar
                        ms.Write(new byte[] { 0x1B, 0x64, 0x03 }, 0, 3);
                    }

                    return ms.ToArray();
                }
            }
        }
    }
}
'@

try {
    Add-Type -AssemblyName System.Drawing
    if (-not ([System.Management.Automation.PSTypeName]'RawComPrinter').Type) {
        Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
    }

    $targetPrinter = $PrinterName
    $installed = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters

    if (-not $targetPrinter -or $targetPrinter.Trim() -eq "") {
        if ($installed -contains "Thermal Printer") {
            $targetPrinter = "Thermal Printer"
        } else {
            $targetPrinter = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName
        }
    }

    $isBluetooth = ($targetPrinter -like '*RPP*' -or $targetPrinter -like '*COM*' -or $targetPrinter -eq 'COM6' -or $targetPrinter -like '*Bluetooth*')
    $comPort = "COM6"
    if ($targetPrinter -match '(COM\d+)') {
        $comPort = $matches[1]
    }

    if (-not $isBluetooth) {
        try {
            $pObj = Get-CimInstance Win32_Printer -Filter "Name='$targetPrinter'" -ErrorAction SilentlyContinue
            if ($pObj -and $pObj.PortName -match '(COM\d+)') {
                $isBluetooth = $true
                $comPort = $matches[1]
            }
        } catch {}
    }

    if (-not $isBluetooth) {
        $btDev = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.Present -eq $true -and ($_.FriendlyName -like '*RPP*' -or $_.InstanceId -like '*060384D4AE44*') } | Select-Object -First 1
        if ($btDev) {
            $isBluetooth = $true
            $comPort = "COM6"
        }
    }

    $is58mm = ($PaperWidth -like '*58*' -or $isBluetooth -or $targetPrinter -like '*RPP*')
    $targetDots = 576
    $autoCut = (-not $NoCut)
    if ($is58mm) {
        $targetDots = 384
        $autoCut = $false
    }

    # Resolve spooler printer name
    $spoolerName = $targetPrinter
    if ($installed -contains $targetPrinter) {
        $spoolerName = $targetPrinter
    } elseif ($installed -contains "Thermal Printer") {
        $spoolerName = "Thermal Printer"
    } else {
        $spoolerName = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName
    }

    Write-Host "[PRINT-HELPER] Target Printer: $targetPrinter (Bluetooth: $isBluetooth, Port: $comPort, Width: $targetDots dots, Spooler: $spoolerName)"

    # If TestFeed requested, send test ticket
    if ($TestFeed) {
        $testBytes = [RawThermalPrinter]::GenerateTestTicket($targetPrinter, $isBluetooth, $is58mm)
        if ($isBluetooth) {
            $comSuccess = [RawComPrinter]::SendRawBytes($comPort, $testBytes)
            if ($comSuccess) {
                Write-Output "SUCCESS_TEST: Bluetooth test ticket printed to $comPort ($targetPrinter)"
                exit 0
            }
        }
        $rawSuccess = [RawThermalPrinter]::SendRawBytes($spoolerName, $testBytes)
        if ($rawSuccess) {
            Write-Output "SUCCESS_TEST: Test ticket printed to $spoolerName"
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

    # Step 1: Attempt direct ESC/POS printing (COM Port for Bluetooth, Winspool for USB)
    try {
        $escposBytes = [RawThermalPrinter]::ConvertImageToEscPos($resolvedPath, $targetDots, $autoCut)
        if ($isBluetooth) {
            $comSuccess = [RawComPrinter]::SendRawBytes($comPort, $escposBytes)
            if ($comSuccess) {
                Write-Output "SUCCESS_BLUETOOTH: Printed ESC/POS bitmap wirelessly to $comPort ($targetPrinter)"
                exit 0
            }
        }

        $rawSuccess = [RawThermalPrinter]::SendRawBytes($spoolerName, $escposBytes)
        if ($rawSuccess) {
            Write-Output "SUCCESS_RAW: Printed ESC/POS bitmap to $spoolerName"
            exit 0
        }
    } catch {
        Write-Warning "RAW error: $($_.Exception.Message). Falling back to GDI..."
    }

    # Step 2: Fallback to GDI PrintDocument
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $spoolerName
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
