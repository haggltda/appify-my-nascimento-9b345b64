import { useCallback, useRef, useState } from "react";

export interface RecorderState {
  isRecording: boolean;
  isSupported: boolean;
  level: number; // 0..1
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isSupported: typeof window !== "undefined" && !!navigator.mediaDevices && typeof MediaRecorder !== "undefined",
    level: 0,
  });
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("audio/webm");

  const stopAnalyser = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    chunksRef.current = [];
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
    const mime = candidates.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
    mimeRef.current = mime || "audio/webm";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start(250);
    recRef.current = rec;
    // Analisador para waveform
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    audioCtxRef.current = ctx;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      setState((s) => ({ ...s, level: Math.min(1, rms * 3) }));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    setState((s) => ({ ...s, isRecording: true }));
  }, []);

  const stop = useCallback(async (): Promise<{ base64: string; mime: string } | null> => {
    const rec = recRef.current;
    if (!rec) return null;
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeRef.current }));
    });
    rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopAnalyser();
    setState((s) => ({ ...s, isRecording: false, level: 0 }));
    const blob = await done;
    const buf = await blob.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    return { base64, mime: mimeRef.current };
  }, []);

  const cancel = useCallback(() => {
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopAnalyser();
    setState((s) => ({ ...s, isRecording: false, level: 0 }));
  }, []);

  return { ...state, start, stop, cancel };
}
