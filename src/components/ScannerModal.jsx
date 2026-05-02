import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Flashlight, FlashlightOff, Loader2, Minus, Plus, X, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Barcode-only format list (no QR / 2D codes) ─────────────────────────────
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,   // most common retail / logistics
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.EAN_13,     // retail product barcodes
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.ITF,        // cartons / shipping
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.RSS_14,     // GS1 DataBar
  Html5QrcodeSupportedFormats.RSS_EXPANDED,
];

// ─── Scan config tuned for 1-D barcodes ──────────────────────────────────────
// • High FPS so fast movement doesn't miss a frame
// • Wide, short qrbox matches the elongated shape of barcodes
// • aspectRatio > 1 gives a landscape camera view
const SCAN_CONFIG = {
  fps: 24,
  qrbox: { width: 320, height: 120 },  // wide rectangle — ideal for 1-D codes
  aspectRatio: 16 / 9,                 // landscape crops out irrelevant area
  formatsToSupport: BARCODE_FORMATS,
  experimentalFeatures: {
    useBarCodeDetectorIfSupported: true, // use native BarcodeDetector API when available (faster)
  },
};

// Camera constraints: request the highest-resolution rear camera available.
// More pixels → easier to resolve narrow barcode bars at a distance.
const CAMERA_CONSTRAINTS = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  focusMode: { ideal: 'continuous' },   // keep autofocus active
};

// How long (ms) to ignore subsequent scans after one succeeds (prevents duplicates)
const SCAN_COOLDOWN_MS = 1500;

// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerModal({ onClose, onScan, continuous = false }) {
  const scannerRef   = useRef(null);
  const isStoppingRef = useRef(false);
  const lastScanRef  = useRef(0);      // timestamp of last accepted scan
  const videoTrackRef = useRef(null);  // raw MediaStreamTrack for torch / zoom

  const [isStarting, setIsStarting]   = useState(true);
  const [errorMsg, setErrorMsg]       = useState('');
  const [torchOn, setTorchOn]         = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoom, setZoom]               = useState(1);
  const [zoomRange, setZoomRange]     = useState({ min: 1, max: 1, step: 0.1 });
  const [zoomSupported, setZoomSupported] = useState(false);
  const [lastScanned, setLastScanned] = useState('');

  // ── Torch toggle ────────────────────────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    const track = videoTrackRef.current;
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  }, [torchOn]);

  // ── Zoom control ────────────────────────────────────────────────────────────
  const applyZoom = useCallback(async (value) => {
    const track = videoTrackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: value }] });
      setZoom(value);
    } catch (e) {
      console.warn('Zoom failed:', e);
    }
  }, []);

  const stepZoom = useCallback((direction) => {
    setZoom(prev => {
      const next = parseFloat(
        Math.min(zoomRange.max, Math.max(zoomRange.min, prev + direction * zoomRange.step)).toFixed(1)
      );
      applyZoom(next);
      return next;
    });
  }, [zoomRange, applyZoom]);

  // ── Scan handler (with cooldown for continuous mode) ─────────────────────
  const handleScan = useCallback(async (decodedText) => {
    const now = Date.now();
    if (now - lastScanRef.current < SCAN_COOLDOWN_MS) return; // debounce
    lastScanRef.current = now;

    if (continuous) {
      // In continuous mode: surface the result but keep the camera running
      setLastScanned(decodedText);
      onScan(decodedText);
      return;
    }

    // Single-scan mode: stop the camera then report
    if (!scannerRef.current || isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      await scannerRef.current.stop();
      onScan(decodedText);
    } catch (err) {
      console.error('Stop failed:', err);
    }
  }, [onScan, continuous]);

  // ── Camera startup ───────────────────────────────────────────────────────
  const start = useCallback(async (cameraConfig) => {
    await scannerRef.current.start(
      cameraConfig,
      SCAN_CONFIG,
      handleScan,
      () => {} // silent per-frame decode errors
    );
  }, [handleScan]);

  // Probe the video track for torch / zoom capability after camera starts
  const probeTrackCapabilities = useCallback(() => {
    // html5-qrcode attaches the <video> element inside #reader
    const video = document.querySelector('#reader video');
    if (!video || !video.srcObject) return;

    const [track] = video.srcObject.getVideoTracks();
    if (!track) return;
    videoTrackRef.current = track;

    const caps = track.getCapabilities?.() ?? {};

    if (caps.torch) {
      setTorchSupported(true);
    }

    if (caps.zoom) {
      setZoomSupported(true);
      setZoomRange({
        min:  caps.zoom.min  ?? 1,
        max:  caps.zoom.max  ?? 1,
        step: caps.zoom.step ?? 0.1,
      });
      setZoom(caps.zoom.min ?? 1);
    }
  }, []);

  useEffect(() => {
    const scanner = new Html5Qrcode('reader');
    scannerRef.current = scanner;
    let mounted = true;

    const init = async () => {
      try {
        await start(CAMERA_CONSTRAINTS);
      } catch {
        // Fallback: let the browser pick any camera
        try {
          await start({ facingMode: 'user' });
        } catch (err) {
          if (!mounted) return;
          setErrorMsg(err?.message || 'Failed to access camera.');
        }
      } finally {
        if (mounted) {
          setIsStarting(false);
          // Small delay lets the video element attach before we query it
          setTimeout(probeTrackCapabilities, 800);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current.clear();
        });
      }
    };
  }, [start, probeTrackCapabilities]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay">
      <div className="modal-content">

        {/* Header */}
        <div className="modal-header">
          <h3 className="text-gradient">Scan Barcode</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="scanner-container">
          {isStarting && !errorMsg && (
            <div className="overlay-center text-secondary">
              <Loader2 className="animate-spin" size={32} />
              <span>Starting camera…</span>
            </div>
          )}

          {errorMsg && (
            <div className="overlay-center text-danger">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Corner brackets drawn in CSS to guide the user */}
          {!isStarting && !errorMsg && <div className="scan-brackets" aria-hidden />}

          <div id="reader" style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Controls row */}
        {!isStarting && !errorMsg && (
          <div className="controls-row">
            {/* Torch */}
            {torchSupported && (
              <button
                className={`ctrl-btn ${torchOn ? 'ctrl-btn--active' : ''}`}
                onClick={toggleTorch}
                aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
              >
                {torchOn ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
                <span>{torchOn ? 'Flash Off' : 'Flash'}</span>
              </button>
            )}

            {/* Zoom */}
            {zoomSupported && (
              <div className="zoom-control" aria-label="Zoom">
                <button
                  className="ctrl-btn zoom-step"
                  onClick={() => stepZoom(-1)}
                  disabled={zoom <= zoomRange.min}
                  aria-label="Zoom out"
                >
                  <Minus size={16} />
                </button>
                <span className="zoom-label">
                  <ZoomIn size={14} />
                  {zoom.toFixed(1)}×
                </span>
                <button
                  className="ctrl-btn zoom-step"
                  onClick={() => stepZoom(1)}
                  disabled={zoom >= zoomRange.max}
                  aria-label="Zoom in"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Continuous-mode last result */}
        {continuous && lastScanned && (
          <div className="last-scan">
            <span className="last-scan__label">Last scan</span>
            <span className="last-scan__value">{lastScanned}</span>
          </div>
        )}

        <p className="hint-text">
          Align the barcode inside the frame. Tap <strong>Flash</strong> if lighting is poor.
        </p>
      </div>

      <style>{`
        /* ── Layout ──────────────────────────────────────────── */
        .modal-content {
          padding: 1.25rem;
          max-width: 420px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* ── Scanner viewfinder ──────────────────────────────── */
        .scanner-container {
          position: relative;
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
        }

        /* Corner-bracket overlay — guides user to a wide barcode region */
        .scan-brackets::before,
        .scan-brackets::after {
          content: '';
          position: absolute;
          width: 48px;
          height: 48px;
          border-color: var(--accent, #4ade80);
          border-style: solid;
          z-index: 20;
          pointer-events: none;
        }
        .scan-brackets::before {
          top: calc(50% - 60px);
          left: 20px;
          border-width: 3px 0 0 3px;
          border-radius: 4px 0 0 0;
          box-shadow: -3px -3px 0 0 var(--accent, #4ade80), 3px 0 0 0 transparent;
        }
        .scan-brackets::after {
          top: calc(50% - 60px);
          right: 20px;
          border-width: 3px 3px 0 0;
          border-radius: 0 4px 0 0;
        }

        /* Animated laser line */
        .scanner-container::after {
          content: '';
          position: absolute;
          left: 10%;
          right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent, #4ade80), transparent);
          top: calc(50% - 1px);
          animation: laser 2s ease-in-out infinite;
          z-index: 15;
          pointer-events: none;
          border-radius: 2px;
        }

        @keyframes laser {
          0%, 100% { opacity: 0.15; transform: scaleX(0.6); }
          50%       { opacity: 1;    transform: scaleX(1); }
        }

        /* ── Status overlays ─────────────────────────────────── */
        .overlay-center {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
          z-index: 10;
        }
        .text-secondary { color: var(--text-secondary, #94a3b8); }
        .text-danger    { color: var(--danger, #f87171); }

        /* ── Controls row ────────────────────────────────────── */
        .controls-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .ctrl-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.85rem;
          border-radius: 8px;
          border: 1px solid var(--border, rgba(255,255,255,0.15));
          background: var(--surface, rgba(255,255,255,0.06));
          color: var(--text, #e2e8f0);
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .ctrl-btn:hover   { background: var(--surface-hover, rgba(255,255,255,0.12)); }
        .ctrl-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .ctrl-btn--active { background: var(--accent, #4ade80); color: #000; border-color: transparent; }

        .zoom-control {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          border: 1px solid var(--border, rgba(255,255,255,0.15));
          border-radius: 8px;
          padding: 0.2rem 0.5rem;
          background: var(--surface, rgba(255,255,255,0.06));
        }

        .zoom-step {
          border: none;
          background: transparent;
          padding: 0.25rem;
        }

        .zoom-label {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.8rem;
          color: var(--text, #e2e8f0);
          min-width: 3rem;
          justify-content: center;
        }

        /* ── Continuous-mode result pill ─────────────────────── */
        .last-scan {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.55rem 0.85rem;
          border-radius: 8px;
          background: var(--success-bg, rgba(74,222,128,0.12));
          border: 1px solid var(--success, rgba(74,222,128,0.35));
          animation: pop 0.2s ease;
        }
        .last-scan__label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--accent, #4ade80);
          white-space: nowrap;
        }
        .last-scan__value {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text, #e2e8f0);
          word-break: break-all;
        }
        @keyframes pop {
          from { transform: scale(0.96); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }

        /* ── Hint ────────────────────────────────────────────── */
        .hint-text {
          text-align: center;
          font-size: 0.8rem;
          color: var(--text-secondary, #94a3b8);
          margin: 0;
        }

        /* ── Suppress html5-qrcode built-in UI chrome ────────── */
        #reader__dashboard_section_csr,
        #reader__dashboard_section_swaplink,
        #reader__header_message,
        #reader__status_span,
        #reader__dashboard { display: none !important; }

        #reader video {
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}