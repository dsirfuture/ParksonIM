"use client";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import type { MobileReceiptI18n } from "@/lib/mobile-receipt-i18n";

type ItemStatus = "pending" | "in_progress" | "completed";

type ItemRow = {
  id: string;
  sku: string;
  barcode: string;
  casePack: number | null;
  expectedQty: number | null;
  goodQty: number;
  excessQty: number;
  uncheckedQty: number;
  status: ItemStatus;
  unexpected?: boolean;
};

type SummaryState = {
  totalSku: number;
  addedCount: number;
  expectedQtyTotal: number;
  goodQtyTotal: number;
  diffQtyTotal: number;
  uncheckedQtyTotal: number;
  damagedQtyTotal: number;
  excessQtyTotal: number;
  progress: number;
};

type NextReceiptState = {
  publicShareId: string;
  supplierName: string;
  receiptNo: string;
};

type NoticeTone = "success" | "error" | "info";

type NoticeState = {
  code: string;
  message: string;
  tone: NoticeTone;
};

type CompletionPromptState = {
  code: string;
};

type ScanConfirmState = {
  code: string;
};

type NativeBarcodeDetectorShape = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type NativeBarcodeDetectorCtor = new (options: {
  formats: string[];
}) => NativeBarcodeDetectorShape;

type MobileScanClientProps = {
  lang: Lang;
  receiptNo: string;
  supplierName: string;
  inspectedAtText: string;
  rows: ItemRow[];
  initialSummary: SummaryState;
  receiptLocked: boolean;
  receiptStatus: ItemStatus;
  initialNextReceipt: NextReceiptState | null;
  stateEndpoint: string;
  scanEndpoint: string;
  evidenceEndpoint: string;
  completeEndpoint: string;
  text: MobileReceiptI18n;
};

const SCAN_CONFIRM_COOLDOWN_MS = 3000;

function speakNotice(message: string, speechLang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  window.setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = speechLang;
    utterance.rate = 1.02;
    utterance.pitch = 1;
    synth.speak(utterance);
  }, 90);
}

function playNoticeSignal(tone: NoticeTone) {
  if (typeof window === "undefined") return;

  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      if (tone === "error") navigator.vibrate([70, 40, 90]);
      else if (tone === "success") navigator.vibrate(60);
      else navigator.vibrate([40, 30, 40]);
    }
  } catch {
    // Ignore vibrate errors.
  }

  try {
    const AudioCtor = (window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtor) return;

    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    if (tone === "error") {
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(320, now);
      oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.2);
    } else if (tone === "success") {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(740, now);
      oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.16);
    } else {
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(620, now);
      oscillator.frequency.exponentialRampToValueAtTime(700, now + 0.14);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);

    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, 320);
  } catch {
    // Ignore audio errors.
  }
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

function extFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

export function MobileScanClient({
  lang,
  receiptNo,
  supplierName,
  inspectedAtText,
  rows,
  initialSummary,
  receiptLocked,
  receiptStatus,
  initialNextReceipt,
  stateEndpoint,
  scanEndpoint,
  evidenceEndpoint,
  completeEndpoint,
  text,
}: MobileScanClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(rows);
  const [summary, setSummary] = useState(initialSummary);
  const [inspectedAt, setInspectedAt] = useState(inspectedAtText);
  const [locked, setLocked] = useState(receiptLocked);
  const [status, setStatus] = useState<ItemStatus>(receiptStatus);
  const [nextReceipt, setNextReceipt] = useState<NextReceiptState | null>(initialNextReceipt);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraPermissionOpen, setCameraPermissionOpen] = useState(false);
  const [completionPrompt, setCompletionPrompt] = useState<CompletionPromptState | null>(null);
  const [scanConfirm, setScanConfirm] = useState<ScanConfirmState | null>(null);
  const [uncheckedOpen, setUncheckedOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanEngine, setScanEngine] = useState<"idle" | "native" | "html5">("idle");
  const [completing, setCompleting] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectTimerRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ code: string; at: number } | null>(null);
  const mobileEvidenceCountRef = useRef<Record<string, number>>({});
  const completionAnnouncedRef = useRef(
    initialSummary.expectedQtyTotal > 0 && initialSummary.uncheckedQtyTotal <= 0,
  );
  const pendingScanCodeRef = useRef<string | null>(null);

  useEffect(() => {
    pendingScanCodeRef.current = scanConfirm?.code || null;
  }, [scanConfirm]);

  function requestScanConfirm(rawCode: string) {
    const code = rawCode.trim();
    if (!code || pendingScanCodeRef.current) return;
    const now = Date.now();
    const last = lastScannedRef.current;
    if (last && last.code === code && now - last.at < SCAN_CONFIRM_COOLDOWN_MS) {
      return;
    }
    setNotice(null);
    setScanConfirm({ code });
  }

  async function confirmPendingScan() {
    if (!scanConfirm) return;
    const code = scanConfirm.code;
    pendingScanCodeRef.current = null;
    setScanConfirm(null);
    lastScannedRef.current = { code, at: Date.now() };
    await submitCode(code);
  }

  function cancelPendingScan() {
    if (!scanConfirm) return;
    pendingScanCodeRef.current = null;
    lastScannedRef.current = { code: scanConfirm.code, at: Date.now() };
    setScanConfirm(null);
  }

  const sortedRows = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (highlightedItemId) {
          if (a.id === highlightedItemId && b.id !== highlightedItemId) return -1;
          if (a.id !== highlightedItemId && b.id === highlightedItemId) return 1;
        }
        return a.sku.localeCompare(b.sku, "zh-CN", { numeric: true, sensitivity: "base" });
      }),
    [highlightedItemId, items],
  );
  const uncheckedRows = useMemo(
    () => sortedRows.filter((row) => !row.unexpected && row.uncheckedQty > 0),
    [sortedRows],
  );

  async function fetchState() {
    const response = await fetch(stateEndpoint, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result?.error || text.ui.stateFailed);
    }
    setItems(result.rows || []);
    setSummary(result.summary || initialSummary);
    setInspectedAt(result.inspectedAtText || "-");
    setLocked(Boolean(result.receiptLocked));
    setStatus(result.receiptStatus || "pending");
    setNextReceipt(result.nextReceipt || null);
    return result;
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchState().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [stateEndpoint]);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, [lang]);

  function showNotice(
    code: string,
    message: string,
    tone: NoticeTone,
    speechMessage = message,
  ) {
    playNoticeSignal(tone);
    setNotice({
      code: code || receiptNo,
      message,
      tone,
    });
    speakNotice(speechMessage, text.speechLang);
  }

  function getStatusLabel(row: ItemRow) {
    if (row.unexpected) return text.status.unexpected;
    if (row.status === "completed") return text.status.completed;
    if (row.status === "in_progress") return text.status.inProgress;
    return text.status.pending;
  }

  function announceProgress(nextSummary: SummaryState) {
    if (nextSummary.expectedQtyTotal <= 0) return;

    if (nextSummary.uncheckedQtyTotal <= 0) {
      if (!completionAnnouncedRef.current) {
        showNotice(receiptNo, text.ui.receiptCompleted, "success", text.tts.receiptCompleted);
      }
      completionAnnouncedRef.current = true;
      return true;
    }

    completionAnnouncedRef.current = false;
    return false;
  }

  async function submitCode(rawCode: string) {
    const code = rawCode.trim();
    if (!code) return;

    const normalized = normalizeCode(code);
    const localMatched = items.find((row) => {
      const sku = normalizeCode(row.sku || "");
      const barcode = normalizeCode(row.barcode || "");
      return sku === normalized || barcode === normalized;
    });
    if (localMatched?.id) {
      setHighlightedItemId(localMatched.id);
    }

    if (locked || status === "completed") {
      showNotice(receiptNo, text.ui.receiptCompleted, "info", text.tts.receiptCompleted);
      return;
    }

    try {
      const response = await fetch(scanEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (result?.error === "OVER_RECEIVED") {
          showNotice(result?.code || code, text.ui.overReceived, "error", text.tts.overReceived);
          return;
        }
        if (result?.error === "UNKNOWN_BARCODE") {
          showNotice(code, text.ui.unknownBarcode, "info", text.tts.unknownBarcode);
          return;
        }
        showNotice(code, text.ui.scanFailed, "error", text.tts.scanFailed);
        return;
      }

      await fetchState();

      if (result.justCompleted) {
        speakNotice(text.tts.quantityFull, text.speechLang);
        setCompletionPrompt({
          code: result.code || code,
        });
      }

      const scannedSku = String(result?.scannedItem?.sku || result.code || code).trim();
      const scannedUncheckedQty = Number(result?.scannedItem?.uncheckedQty ?? NaN);
      const scannedItemId = String(result?.scannedItem?.id || "").trim();
      if (scannedItemId) {
        setHighlightedItemId(scannedItemId);
      } else if (scannedSku) {
        const matchedRow = (result?.rows || []).find?.((row: ItemRow) => String(row.sku || row.barcode || "").trim() === scannedSku);
        if (matchedRow?.id) setHighlightedItemId(matchedRow.id);
      }

      if (!Number.isNaN(scannedUncheckedQty) && scannedUncheckedQty >= 0 && scannedSku) {
        const remainingBySkuMessage = `未验${scannedUncheckedQty} 个`;
        const remainingBySkuSpeech =
          text.speechLang === "zh-CN"
            ? `未验${scannedUncheckedQty}个`
            : `Faltan ${scannedUncheckedQty}`;
        showNotice(scannedSku, remainingBySkuMessage, "info", remainingBySkuSpeech);
        return;
      }

      const announced = announceProgress(result.summary || initialSummary);
      if (!result.justCompleted && !announced) {
        showNotice(result.code || code, text.ui.scanSuccess, "success", text.tts.scanSuccess);
      }
    } catch {
      showNotice(code, text.ui.scanFailed, "error", text.tts.scanFailed);
    }
  }

  async function handleCompletionPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !completionPrompt) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          throw new Error(text.ui.photoReadFailed);
        }
        setUploadingPhoto(true);
        speakNotice(text.tts.uploading, text.speechLang);
        const response = await fetch(evidenceEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            files: [
              {
                fileName: (() => {
                  const code = String(completionPrompt.code || "").trim() || "ITEM";
                  const current = mobileEvidenceCountRef.current[code] || 0;
                  const next = current + 1;
                  mobileEvidenceCountRef.current[code] = next;
                  const ext = extFromMimeType(file.type || "image/jpeg");
                  return `${code}-${next}.${ext}`;
                })(),
                mimeType: file.type || "image/jpeg",
                fileSize: file.size,
                dataUrl,
              },
            ],
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result?.error || text.ui.photoSaveFailed);
        }
        const completedCode = completionPrompt.code;
        setCompletionPrompt(null);
        showNotice(completedCode, text.ui.photoSaved, "success", text.tts.photoSaved);
      } catch (error) {
        showNotice(
          completionPrompt.code,
          error instanceof Error ? error.message : text.ui.photoSaveFailed,
          "error",
        );
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearNativeDetectTimer() {
    if (detectTimerRef.current !== null) {
      window.clearTimeout(detectTimerRef.current);
      detectTimerRef.current = null;
    }
  }

  async function stopCamera() {
    clearNativeDetectTimer();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore stop errors when scanner is already closed.
      }
      try {
        scannerRef.current.clear();
      } catch {
        // Ignore clear errors for already released nodes.
      }
      scannerRef.current = null;
    }
    setCameraRunning(false);
    setScanEngine("idle");
  }

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  async function startCamera() {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(text.ui.cameraUnsupported);
      return;
    }

    try {
      setCameraError("");
      await stopCamera();

      const NativeBarcodeDetector = (window as typeof window & {
        BarcodeDetector?: NativeBarcodeDetectorCtor;
      }).BarcodeDetector;

      if (NativeBarcodeDetector && videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();

          const detector = new NativeBarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf"],
          });

          const runDetect = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
              if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                const barcodes = await detector.detect(videoRef.current);
                const code = String(barcodes?.[0]?.rawValue || "").trim();
                if (code) {
                  requestScanConfirm(code);
                }
              }
            } catch {
              // Ignore detect-frame errors and continue polling.
            }
            detectTimerRef.current = window.setTimeout(() => {
              void runDetect();
            }, 80);
          };

          setScanEngine("native");
          setCameraRunning(true);
          void runDetect();
          return;
        } catch {
          clearNativeDetectTimer();
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
          }
        }
      }

      const scanner = new Html5Qrcode("mobile-receipt-reader", {
        verbose: false,
        useBarCodeDetectorIfSupported: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.ITF,
        ],
      });
      scannerRef.current = scanner;
      const onScanSuccess = async (decodedText: string) => {
        const code = decodedText.trim();
        if (!code) return;
        requestScanConfirm(code);
      };
      const cameraConfig = {
        fps: 30,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
          width: Math.max(260, Math.floor(viewfinderWidth * 0.9)),
          height: Math.max(90, Math.floor(viewfinderHeight * 0.28)),
        }),
        aspectRatio: 1.7777778,
        disableFlip: true,
        videoConstraints: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      let started = false;
      try {
        const cameras = await Html5Qrcode.getCameras();
        const rearCamera =
          cameras.find((camera) =>
            /back|rear|environment|traseira|trasera|后|背/i.test(camera.label || ""),
          ) || cameras[cameras.length - 1];
        if (rearCamera?.id) {
          await scanner.start(
            rearCamera.id,
            cameraConfig,
            onScanSuccess,
            () => {
              // Ignore frame-level decode failures while scanning.
            },
          );
          started = true;
        }
      } catch {
        started = false;
      }

      if (!started) {
        await scanner.start(
          {
            facingMode: { ideal: "environment" },
          },
          cameraConfig,
          onScanSuccess,
          () => {
            // Ignore frame-level decode failures while scanning.
          },
        );
      }
      setScanEngine("html5");
      setCameraRunning(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      setCameraError(text.ui.cameraDenied);
      await stopCamera();
    }
  }

  async function handleManualSubmit(event: FormEvent) {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    await submitCode(code);
  }

  async function confirmStartCamera() {
    setCameraPermissionOpen(false);
    await startCamera();
  }

  async function handleFinishInspection() {
    if (completing || locked || status === "completed") return;
    try {
      setCompleting(true);
      const response = await fetch(completeEndpoint, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.ui.finishInspectionFailed);
      }
      await fetchState();
      showNotice(receiptNo, text.ui.receiptCompleted, "success", text.tts.receiptCompleted);
    } catch (error) {
      showNotice(
        receiptNo,
        error instanceof Error ? error.message : text.ui.finishInspectionFailed,
        "error",
        text.tts.finishInspectionFailed,
      );
    } finally {
      setCompleting(false);
    }
  }

  function switchLang(nextLang: Lang) {
    if (nextLang === lang) return;
    document.cookie = `lang=${nextLang}; path=/; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLang);
    window.location.href = `${pathname}?${params.toString()}`;
  }

  function goToNextReceipt() {
    if (!nextReceipt?.publicShareId) return;
    setNotice(null);
    setCompletionPrompt(null);
    void stopCamera().finally(() => {
      router.push(`/public/receipts/${nextReceipt.publicShareId}/scan?lang=${lang}`);
    });
  }

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-4 text-slate-900">
      {notice && !scanConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4"
          onClick={() => setNotice(null)}
        >
          <div className="w-full max-w-md rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
            <div className="mt-2 break-all text-[5.8vw] font-black tracking-[0.06em] text-slate-900">
              {notice.code}
            </div>
            <div
              className={`mt-5 text-[6.8vw] font-black leading-none ${
                /^未验\s*\d+\s*个$/.test(notice.message)
                  ? "text-rose-500"
                  : notice.message === text.ui.receiptCompleted
                  ? "text-emerald-600"
                  : notice.tone === "error"
                    ? "text-rose-500"
                    : "text-slate-900"
              }`}
            >
              {notice.message}
            </div>
            {notice.message === text.ui.receiptCompleted && nextReceipt ? (
              <div className="mt-5">
                <div className="text-sm font-semibold text-slate-500">
                  {text.ui.nextSupplier}：{nextReceipt.supplierName}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    goToNextReceipt();
                  }}
                  className="mt-4 inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-base font-semibold text-white"
                >
                  {text.ui.nextReceipt}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {scanConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white px-6 py-8 text-center shadow-2xl">
            <div className="text-3xl font-black text-slate-900">{scanConfirm.code}</div>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={cancelPendingScan}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-700"
              >
                {text.ui.close}
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingScan()}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-4 text-base font-semibold text-white"
              >
                {lang === "es" ? "Confirmar" : "确认"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {completionPrompt ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white px-6 py-8 text-center shadow-2xl">
            <div className="text-3xl font-black text-slate-900">{completionPrompt.code}</div>
            <div className="mt-3 text-5xl font-black text-emerald-600">{text.ui.quantityFull}</div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCompletionPhotoChange}
            />
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-4 text-base font-semibold text-white disabled:opacity-60"
              >
                {uploadingPhoto ? text.ui.uploading : text.ui.takePhoto}
              </button>
              <button
                type="button"
                onClick={() => setCompletionPrompt(null)}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-700"
              >
                {text.ui.skip}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {cameraPermissionOpen ? (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-950/55 px-4"
          onClick={() => setCameraPermissionOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white px-6 py-8 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-[9vw] font-black tracking-[0.04em] text-slate-900">
              {text.ui.cameraPermissionTitle}
            </div>
            <div className="mt-4 text-[6vw] font-semibold leading-snug text-slate-700">
              {text.ui.cameraPermissionMessage}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCameraPermissionOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-700"
              >
                {text.ui.close}
              </button>
              <button
                type="button"
                onClick={() => void confirmStartCamera()}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-4 text-base font-semibold text-white"
              >
                {text.ui.cameraPermissionConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {uncheckedOpen ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/55 px-4"
          onClick={() => setUncheckedOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-[28px] bg-white px-5 py-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-black text-slate-900">{text.ui.uncheckedListTitle}</div>
              <button
                type="button"
                onClick={() => setUncheckedOpen(false)}
                className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-600"
              >
                {text.ui.close}
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
              {uncheckedRows.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {text.ui.noUncheckedItems}
                </div>
              ) : (
                uncheckedRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <div className="text-lg font-bold text-slate-900">{row.sku || row.barcode || "-"}</div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl bg-slate-50 px-2 py-3">
                        <div className="text-xs text-slate-500">{text.ui.expectedQty}</div>
                        <div className="mt-1 text-lg font-black">{row.expectedQty ?? 0}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-2 py-3">
                        <div className="text-xs text-slate-500">{text.ui.goodQty}</div>
                        <div className="mt-1 text-lg font-black">{row.goodQty}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-2 py-3">
                        <div className="text-xs text-slate-500">{text.ui.uncheckedQty}</div>
                        <div className="mt-1 text-lg font-black text-rose-600">{row.uncheckedQty}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-xl space-y-4">
        <section className="rounded-[24px] bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[1.2rem] font-black tracking-tight">{receiptNo}</div>
              <div className="pb-1 pt-1 text-sm font-semibold text-slate-500">
                {text.ui.supplier}：{supplierName}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1 text-xs font-semibold leading-none">
              <button
                type="button"
                onClick={() => switchLang("zh")}
                className={lang === "zh" ? "text-primary" : "text-slate-500"}
              >
                {text.ui.langZh}
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => switchLang("es")}
                className={lang === "es" ? "text-primary" : "text-slate-500"}
              >
                {text.ui.langEs}
              </button>
            </div>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${summary.progress}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
              <div className="text-xs text-slate-500">{text.ui.expectedQty}</div>
              <div className="mt-1 text-xl font-black">{summary.expectedQtyTotal}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
              <div className="text-xs text-slate-500">{text.ui.goodQty}</div>
              <div className="mt-1 text-xl font-black">{summary.goodQtyTotal}</div>
            </div>
            <button
              type="button"
              onClick={() => setUncheckedOpen(true)}
              className="rounded-2xl bg-slate-50 px-3 py-3 text-center"
            >
              <div className="text-xs text-slate-500">{text.ui.uncheckedQty}</div>
              <div className="mt-1 text-xl font-black">{summary.uncheckedQtyTotal}</div>
            </button>
            <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
              <div className="text-xs text-slate-500">{text.ui.excessQty}</div>
              <div className="mt-1 text-xl font-black">{summary.excessQtyTotal}</div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-soft">
          <style jsx>{`
            .mobile-scan-line {
              animation: mobile-scan-line-move 1.6s linear infinite;
              position: relative;
            }
            .mobile-scan-line::before {
              content: "";
              position: absolute;
              inset: -14px -10px;
              background: linear-gradient(
                90deg,
                rgba(34, 197, 94, 0),
                rgba(34, 197, 94, 0.12),
                rgba(34, 197, 94, 0.3),
                rgba(34, 197, 94, 0.12),
                rgba(34, 197, 94, 0)
              );
              filter: blur(8px);
            }
            @keyframes mobile-scan-line-move {
              0% {
                transform: translateX(-15%);
              }
              100% {
                transform: translateX(calc(100vw - 10rem));
              }
            }
          `}</style>
          <div className="relative h-[214px] overflow-hidden rounded-[20px] bg-slate-100">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`absolute inset-0 h-full w-full rounded-[20px] object-cover ${scanEngine === "native" ? "block" : "hidden"}`}
            />
            <div
              id="mobile-receipt-reader"
              className={`h-full w-full overflow-hidden rounded-[20px] bg-slate-100 ${scanEngine === "native" ? "hidden" : "block"}`}
            />
            {!cameraRunning ? (
              <button
                type="button"
                onClick={() => setCameraPermissionOpen(true)}
                className="absolute inset-0 flex items-center justify-center text-lg font-bold text-primary"
              >
                {text.ui.startCamera}
              </button>
            ) : null}
            {cameraRunning ? (
              <div className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[58%] -translate-y-1/2 overflow-hidden">
                <div className="mobile-scan-line h-full w-[3px] rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.85)]" />
              </div>
            ) : null}
          </div>
          {cameraError ? (
            <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {cameraError}
            </div>
          ) : null}
          <form onSubmit={handleManualSubmit} className="mt-3 flex gap-3">
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder={text.ui.scanPlaceholder}
              className="h-12 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              {text.ui.manualSubmit}
            </button>
          </form>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-lg font-bold">{text.ui.title}</div>
            <button
              type="button"
              onClick={() => void handleFinishInspection()}
              disabled={completing || locked || status === "completed"}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {completing ? text.ui.finishingInspection : text.ui.finishInspection}
            </button>
          </div>
          {sortedRows.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {text.ui.noItems}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRows.map((row) => {
                const isHighlighted = row.id === highlightedItemId;
                return (
                  <div
                    key={row.id}
                    className={`rounded-2xl border px-4 py-4 ${isHighlighted ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200"}`}
                  >
                    <div className={`text-lg font-bold ${isHighlighted ? "text-emerald-700" : "text-slate-900"}`}>
                      {row.sku || row.barcode || "-"}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-3 text-center">
                      <div className={`rounded-2xl px-2 py-3 ${isHighlighted ? "bg-emerald-100" : "bg-slate-50"}`}>
                        <div className={`text-xs ${isHighlighted ? "text-emerald-700" : "text-slate-500"}`}>{text.ui.expectedQty}</div>
                        <div className="mt-1 text-lg font-black">{row.expectedQty ?? 0}</div>
                      </div>
                      <div className={`rounded-2xl px-2 py-3 ${isHighlighted ? "bg-emerald-100" : "bg-slate-50"}`}>
                        <div className={`text-xs ${isHighlighted ? "text-emerald-700" : "text-slate-500"}`}>{text.ui.casePack}</div>
                        <div className="mt-1 text-lg font-black">{row.casePack ?? "-"}</div>
                      </div>
                      <div className={`rounded-2xl px-2 py-3 ${isHighlighted ? "bg-emerald-100" : "bg-slate-50"}`}>
                        <div className={`text-xs ${isHighlighted ? "text-emerald-700" : "text-slate-500"}`}>{text.ui.goodQty}</div>
                        <div className="mt-1 text-lg font-black">{row.goodQty}</div>
                      </div>
                      <div className={`rounded-2xl px-2 py-3 ${isHighlighted ? "bg-emerald-100" : "bg-slate-50"}`}>
                        <div className={`text-xs ${isHighlighted ? "text-emerald-700" : "text-slate-500"}`}>{text.ui.uncheckedQty}</div>
                        <div className="mt-1 text-lg font-black">{row.uncheckedQty}</div>
                      </div>
                    </div>
                    <div className={`mt-3 flex items-center justify-between rounded-2xl px-3 py-3 ${isHighlighted ? "bg-emerald-100" : "bg-slate-50"}`}>
                      <div className={`text-xs ${isHighlighted ? "text-emerald-700" : "text-slate-500"}`}>{text.ui.status}</div>
                      <div className={`text-sm font-bold ${isHighlighted ? "text-emerald-700" : "text-slate-900"}`}>{getStatusLabel(row)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
