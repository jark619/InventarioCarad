'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = { onDetected: (barcode: string) => void };

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

// Usa BarcodeDetector cuando el navegador lo ofrece; los campos manuales cubren lectoras USB/Bluetooth.
export function BarcodeScanner({ onDetected }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const lastDetected = useRef('');
  const missedDetections = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState('Cámara detenida. Actívala para escanear.');

  const prepareAudio = useCallback(async () => {
    const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext.current ??= new AudioContextClass();
    if (audioContext.current.state === 'suspended') await audioContext.current.resume();
  }, []);

  const playBeep = useCallback(() => {
    const context = audioContext.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  }, []);

  const toggleCamera = async () => {
    if (cameraActive) {
      setCameraActive(false);
      setMessage('Cámara detenida. Actívala para escanear.');
      return;
    }
    await prepareAudio();
    lastDetected.current = '';
    missedDetections.current = 0;
    setCameraActive(true);
    setMessage('Iniciando cámara...');
  };

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let detecting = false;

    if (!cameraActive) return;

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
            if (!barcode) {
              missedDetections.current += 1;
              if (missedDetections.current >= 2) lastDetected.current = '';
              return;
            }
            missedDetections.current = 0;
            if (barcode && barcode !== lastDetected.current) {
              lastDetected.current = barcode;
              playBeep();
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
      if (video.current) video.current.srcObject = null;
    };
  }, [cameraActive, onDetected, playBeep]);

  useEffect(() => () => {
    void audioContext.current?.close();
  }, []);

  return <div className="space-y-2">
    {cameraActive
      ? <video ref={video} muted playsInline className="aspect-video w-full rounded-lg bg-slate-900 object-cover" />
      : <div className="grid aspect-video w-full place-items-center rounded-lg bg-slate-900 px-5 text-center text-sm text-slate-300">La cámara está apagada</div>}
    <button type="button" onClick={toggleCamera} className={`w-full ${cameraActive ? 'bg-rose-100 text-rose-700' : 'bg-slate-800 text-white'}`}>{cameraActive ? 'Detener cámara' : 'Activar cámara'}</button>
    <p className="text-sm text-slate-500">{message || 'Apunta la cámara trasera al código de barras'}</p>
  </div>;
}
