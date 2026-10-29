import { reportError } from '../utils/diagnostics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ScanLine, AlertTriangle } from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
}

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): (new (options: { formats: string[] }) => BarcodeDetectorInstance) | null {
  const detector = (window as Window & typeof globalThis & { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorInstance })
    .BarcodeDetector;
  return detector || null;
}

export function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [error, setError] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const detectorAvailable = useMemo(() => !!getBarcodeDetector(), []);
  const cameraAvailable = useMemo(() => !!navigator.mediaDevices?.getUserMedia, []);

  const stopCamera = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError('');
      setManualValue('');
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    if (!cameraAvailable) {
      setError('Camera nao disponivel neste dispositivo.');
      return;
    }

    if (!detectorAvailable) {
      setError('Leitura por QR nao suportada neste navegador. Use o campo manual.');
      return;
    }

    try {
      setIsStarting(true);
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const Detector = getBarcodeDetector();
      if (!Detector) {
        throw new Error('BarcodeDetector indisponivel');
      }

      const detector = new Detector({ formats: ['qr_code'] });

      intervalRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
          const codes = await detector.detect(video);
          const rawValue = codes[0]?.rawValue?.trim();
          if (rawValue) {
            stopCamera();
            onDetected(rawValue);
            onClose();
          }
        } catch {
          // Ignore detection frame errors and keep scanning.
        }
      }, 700);
    } catch (scanError) {
      reportError('Erro ao iniciar camera:', scanError);
      setError('Nao foi possivel acessar a camera. Use a busca manual.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualValue.trim()) {
      setError('Digite um ID, placa ou codigo QR.');
      return;
    }

    onDetected(manualValue.trim());
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Leitura por QR / camera</p>
            <p className="text-sm text-gray-600">Aponte para o QR do veiculo ou use a busca manual.</p>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
          {cameraAvailable ? (
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <div className="text-center text-white/80 p-6">
              <Camera className="w-10 h-10 mx-auto mb-2" />
              <p>Camera indisponivel</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={startCamera}
            disabled={isStarting || !cameraAvailable}
            className="px-4 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {isStarting ? 'Iniciando...' : 'Abrir camera'}
          </button>
          <button
            type="button"
            onClick={stopCamera}
            className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100"
          >
            Parar camera
          </button>
        </div>

        {!detectorAvailable && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>Seu navegador nao suporta leitura automatica de QR. A busca manual continua disponivel.</p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>
        )}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Busca manual</label>
        <input
          value={manualValue}
          onChange={(event) => setManualValue(event.target.value)}
          placeholder="Codigo de 3 digitos, placa ou QR"
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-4 focus:ring-red-100"
        />
        <button
          type="button"
          onClick={handleManualSubmit}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black"
        >
          Conferir codigo
        </button>
      </div>
    </div>
  );
}
