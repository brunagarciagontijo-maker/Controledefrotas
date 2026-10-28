import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';

interface CameraCaptureProps {
  label: string;
  onCapture: (file: File) => void;
  captured?: boolean;
  keepOpenAfterCapture?: boolean;
}

// A captura usa getUserMedia, em vez de confiar no atributo capture de um input.
export function CameraCapture({ label, onCapture, captured = false, keepOpenAfterCapture = false }: CameraCaptureProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [previewLabel,setPreviewLabel]=useState('');
  const [capturing,setCapturing]=useState(false);

  const stop = () => {
    if (video.current) video.current.srcObject = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    if (active && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.scrollIntoView({ block: 'center' });
      void video.current.play().catch(() => setError('Não foi possível iniciar a câmera.'));
    }
  }, [active]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const start = async () => {
    setError(''); setPending(true); setReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      stop();
      let next: MediaStream | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          next = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false,
          });
          break;
        } catch (failure) {
          if (failure instanceof DOMException && ['NotFoundError','OverconstrainedError'].includes(failure.name)) {
            // Usa outra camera disponivel se o navegador nao encontrar a traseira preferida.
            next = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            break;
          }
          // Alguns dispositivos demoram a liberar a camera entre fotografias.
          const transient = failure instanceof DOMException && ['NotReadableError', 'AbortError'].includes(failure.name);
          if (!transient || attempt === 2) throw failure;
          await new Promise(resolve => window.setTimeout(resolve, 200 * (attempt + 1)));
          if (!mounted.current) return;
        }
      }
      if (!next) throw new Error('Camera unavailable');
      if (!mounted.current) { next.getTracks().forEach(track => track.stop()); return; }
      stream.current = next;
      setActive(true);
    } catch {
      if (mounted.current) setError('Câmera indisponível. Permita o acesso e use HTTPS ou localhost. A captura é obrigatória.');
    } finally {
      if (mounted.current) setPending(false);
    }
  };

  const capture = () => {
    const source = video.current;
    if (!source?.videoWidth || !ready || capturing) return;
    setCapturing(true);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / source.videoWidth);
    canvas.width = source.videoWidth * scale;
    canvas.height = source.videoHeight * scale;
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!mounted.current) return;
      if (!blob) { setError('Falha ao capturar a foto.'); setCapturing(false); return; }
      const file = new File([blob], `captura-${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' });
      setPreview(URL.createObjectURL(file));
      setPreviewLabel(label);
      onCapture(file);
      setCapturing(false);
      if(!keepOpenAfterCapture){stop(); setActive(false); setReady(false);}
    }, 'image/jpeg', 0.85);
  };

  return <section className="space-y-3 rounded-xl border border-gray-200 p-3">
    <p className="font-semibold">{label}{captured ? ' — capturado' : ''}</p>
    {preview && <img src={preview} alt={`Última captura: ${previewLabel}`} className="max-h-48 w-full rounded-lg object-contain" />}
    {active && <>
      <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="max-h-64 w-full rounded-lg bg-black" />
      <div className="flex gap-3">
        <button type="button" disabled={!ready||capturing} className="rounded-xl bg-red-700 px-4 py-3 text-white disabled:opacity-50" onClick={capture}>Capturar foto</button>
        <button type="button" className="rounded-xl border px-4 py-3" onClick={() => { stop(); setActive(false); setReady(false); }}>Cancelar câmera</button>
      </div>
    </>}
    {!active && <button type="button" disabled={pending} onClick={() => void start()} className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-3 disabled:opacity-50">
      {captured ? <RotateCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
      {pending ? 'Abrindo câmera…' : captured ? 'Refazer foto' : 'Abrir câmera'}
    </button>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </section>;
}
