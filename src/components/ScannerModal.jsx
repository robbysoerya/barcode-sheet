import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

export default function ScannerModal({ onClose, onScan }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Initialize scanner
    const html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
      /* verbose= */ false
    );

    html5QrcodeScanner.render(
      (decodedText) => {
        // Stop scanning after success to prevent multiple triggers
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
        onScan(decodedText);
      },
      (errorMessage) => {
        // parse error, ignore mostly
      }
    );

    scannerRef.current = html5QrcodeScanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ padding: '1rem', maxWidth: '400px' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-gradient">Scan Barcode</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="scanner-container">
          <div id="reader"></div>
        </div>
        <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Position the barcode within the frame. It will be scanned automatically.
        </p>
      </div>
    </div>
  );
}
