import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Loader2 } from 'lucide-react';

export default function ScannerModal({ onClose, onScan }) {
  const scannerRef = useRef(null);
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    // Initialize scanner with Html5Qrcode instead of Html5QrcodeScanner 
    // to bypass the default UI and have full control
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { 
            // Force back camera
            facingMode: "environment",
            // High resolution request to prevent blur
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          { 
            fps: 15, 
            qrbox: { width: 300, height: 150 }, 
            aspectRatio: 1.0,
            // Only support 1D barcodes, disable QR codes
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.CODE_93,
              Html5QrcodeSupportedFormats.CODABAR,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E
            ]
          },
          (decodedText) => {
            // Success callback
            html5QrCode.stop().then(() => {
              onScan(decodedText);
            }).catch(console.error);
          },
          (errorMessage) => {
            // Ignore parse errors
          }
        );
        setIsStarting(false);
      } catch (err) {
        console.error("Error starting scanner:", err);
        // Fallback to any camera if environment camera fails
        try {
          await html5QrCode.start(
            { facingMode: "user" },
            { fps: 10, qrbox: { width: 300, height: 150 } },
            (decodedText) => {
              html5QrCode.stop().then(() => {
                onScan(decodedText);
              }).catch(console.error);
            },
            () => {}
          );
          setIsStarting(false);
        } catch (fallbackErr) {
          console.error("Fallback scanner failed:", fallbackErr);
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ padding: '1.5rem', maxWidth: '400px' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-gradient">Scan Barcode</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="scanner-container" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isStarting && (
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
              <Loader2 className="animate-spin" size={32} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Starting camera...</span>
            </div>
          )}
          <div id="reader"></div>
        </div>
        <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Position the barcode within the frame. Only standard barcodes are supported.
        </p>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* Hide any injected UI from library just in case */
        #reader__dashboard_section_csr { display: none !important; }
        #reader__dashboard_section_swaplink { display: none !important; }
      `}</style>
    </div>
  );
}
