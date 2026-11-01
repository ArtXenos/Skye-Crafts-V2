"use client";

// Choose a product photo: take one with the camera, or pick a saved one.
//
// - On phones and tablets, "Take a photo" opens the phone's own camera app
//   (the `capture` attribute), which gives the best photos: focus, flash,
//   retakes.
// - On a laptop, it opens the webcam inside the page instead. That needs the
//   camera permission, which next.config.ts allows on /admin pages only.
// - Either way, the photo is shrunk in the browser first (src/lib/photo.ts).
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { canvasToPhoto, preparePhoto } from "@/lib/photo";
import { cn } from "@/lib/utils";

type Props = {
  /** The photo chosen so far (already shrunk), or null. */
  value: File | null;
  onChange: (file: File | null) => void;
  /** The photo the product has now, shown until a new one is chosen. */
  currentUrl?: string | null;
  label: string;
  error?: string;
};

export function PhotoPicker({ value, onChange, currentUrl, label, error }: Props) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [webcamOpen, setWebcamOpen] = useState(false);
  const labelId = useId();
  const messageId = useId();

  // A temporary address for previewing the chosen photo, freed when it changes.
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function use(file: Blob | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem("");
    try {
      onChange(await preparePhoto(file));
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "That photo couldn't be used.");
    } finally {
      setBusy(false);
    }
  }

  function takePhoto() {
    setProblem("");
    const touchScreen = window.matchMedia("(pointer: coarse)").matches;
    if (!touchScreen && "mediaDevices" in navigator) setWebcamOpen(true);
    else cameraInput.current?.click();
  }

  const shown = preview ?? currentUrl ?? null;
  const message = problem || error;

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={message ? messageId : undefined} className="grid gap-3">
      <p id={labelId} className="font-semibold">{label}</p>

      {webcamOpen ? (
        <Webcam
          onCancel={() => setWebcamOpen(false)}
          onSnap={(file) => {
            setWebcamOpen(false);
            onChange(file);
          }}
          onError={(text) => {
            setWebcamOpen(false);
            setProblem(text);
          }}
        />
      ) : (
        <div className={cn("relative grid aspect-square w-full max-w-72 place-items-center overflow-hidden rounded-[var(--radius-tile)] bg-petal ring-2", message ? "ring-alert" : "ring-line")}>
          {shown ? (
            // A blob: preview can't go through the image optimiser.
            <Image src={shown} alt={preview ? "The new photo" : "The current photo"} fill sizes="288px" unoptimized={Boolean(preview)} className="object-cover" />
          ) : (
            <p className="p-6 text-center text-sm text-ink-soft">{busy ? "Preparing the photo…" : "No photo yet"}</p>
          )}
        </div>
      )}

      {!webcamOpen && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={takePhoto}>Take a photo</Button>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
            Choose a saved photo
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>Undo</Button>
          )}
        </div>
      )}
      <p className="text-sm text-ink-soft">
        Use a real photo of the piece in good light. Big photos are made smaller automatically, and the phone&apos;s
        location data is removed.
      </p>
      {message && <Notice tone="error" id={messageId}>{message}</Notice>}

      {/* The real file inputs stay hidden; the buttons above open them. */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden aria-label={`${label}: camera`}
        onChange={(event) => { void use(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={fileInput} type="file" accept="image/*" hidden aria-label={`${label}: saved photo`}
        onChange={(event) => { void use(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
  );
}

/** The laptop webcam, live in the page, with a button to take the picture. */
function Webcam({ onSnap, onCancel, onError }: { onSnap: (file: File) => void; onCancel: () => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  // The latest callbacks, without restarting the camera when they change.
  const callbacks = useRef({ onError });
  useEffect(() => {
    callbacks.current = { onError };
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((started) => {
        if (stopped) {
          started.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = started;
        if (video.current) video.current.srcObject = started;
      })
      .catch((failure: unknown) => {
        const denied = failure instanceof DOMException && failure.name === "NotAllowedError";
        callbacks.current.onError(
          denied
            ? "The camera is blocked. Allow it in the browser's address bar, or choose a saved photo."
            : "No camera was found. Choose a saved photo instead.",
        );
      });
    // Turn the camera (and its light) off when this closes.
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function snap() {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    onSnap(await canvasToPhoto(element, element.videoWidth, element.videoHeight));
  }

  return (
    <div className="grid gap-2">
      <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} aria-label="Camera preview"
        className="aspect-[4/3] w-full max-w-md rounded-[var(--radius-tile)] bg-ink object-cover" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!ready} onClick={() => void snap()}>{ready ? "Snap photo" : "Starting camera…"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
