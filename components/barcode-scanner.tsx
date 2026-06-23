'use client';
import { useEffect, useRef, useState } from 'react';

type Props = { onDetected: (barcode: string) => void };
// Usa BarcodeDetector cuando el navegador lo ofrece; el campo manual cubre lectoras USB.
export function BarcodeScanner({ onDetected }: Props) {
  const video = useRef<HTMLVideoElement>(null); const [message, setMessage] = useState('');
  useEffect(() => { let stream: MediaStream | undefined; let timer: ReturnType<typeof setInterval> | undefined;
    const start = async () => { try { if (!('BarcodeDetector' in window)) { setMessage('Tu navegador no detecta códigos con cámara. Usa el campo manual o una lectora USB.'); return; }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); if (!video.current) return; video.current.srcObject = stream; await video.current.play();
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'qr_code'] });
      timer = setInterval(async () => { if (!video.current) return; const codes = await detector.detect(video.current); if (codes[0]?.rawValue) { onDetected(codes[0].rawValue); setMessage(`Detectado: ${codes[0].rawValue}`); } }, 700);
    } catch { setMessage('No fue posible abrir la cámara. Revisa los permisos.'); } }; start();
    return () => { if (timer) clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [onDetected]);
  return <div className="space-y-2"><video ref={video} muted playsInline className="aspect-video w-full rounded-lg bg-slate-900 object-cover" /><p className="text-sm text-slate-500">{message || 'Apunta al código de barras'}</p></div>;
}
