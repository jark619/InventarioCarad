'use client';

import { useEffect, useRef, useState } from 'react';

type Props = { onDetected: (barcode: string) => void };

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

// Usa BarcodeDetector cuando el navegador lo ofrece; los campos manuales cubren lectoras USB/Bluetooth.
export function BarcodeScanner({ onDetected }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const lastDetected = useRef('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let detecting = false;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMessage('Este navegador no permite abrir la cámara. Usa una lectora USB/Bluetooth en el campo de código.');
          return;
        }

        if (!('BarcodeDetector' in window)) {
          setMessage('Tu navegador no detecta códigos con cámara. Usa el campo manual o una lectora USB/Bluetooth.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        if (!video.current) return;

        video.current.srcObject = stream;
        await video.current.play();

        const Detector = (window as Window & { BarcodeDetector: BarcodeDetectorConstructor }).BarcodeDetector;
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'code_39', 'qr_code'],
        });

        timer = setInterval(async () => {
          if (!video.current || detecting) return;
          detecting = true;

          try {
            const codes = await detector.detect(video.current);
            const barcode = codes[0]?.rawValue?.trim();
            if (barcode && barcode !== lastDetected.current) {
              lastDetected.current = barcode;
              onDetected(barcode);
              setMessage(`Detectado: ${barcode}`);
            }
          } finally {
            detecting = false;
          }
        }, 700);
      } catch {
        setMessage('No fue posible abrir la cámara. Revisa los permisos.');
      }
    };

    start();

    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [onDetected]);

  return <div className="space-y-2">
    <video ref={video} muted playsInline className="aspect-video w-full rounded-lg bg-slate-900 object-cover" />
    <p className="text-sm text-slate-500">{message || 'Apunta la cámara trasera al código de barras'}</p>
  </div>;
}
