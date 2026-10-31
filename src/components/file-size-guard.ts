"use client";

import type { FormEvent } from "react";

/** Matches MAX_UPLOAD_BYTES in src/lib/uploads.ts (the server checks too). */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/**
 * Stop a form from uploading a photo that is too big, before it is sent.
 * Without this, a big phone photo would be refused by the host with a
 * generic error instead of a helpful message.
 */
export function guardPhotoSize(event: FormEvent<HTMLFormElement>, onTooBig: (message: string) => void) {
  const inputs = event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="file"]');
  for (const input of inputs) {
    const file = input.files?.[0];
    if (file && file.size > MAX_PHOTO_BYTES) {
      event.preventDefault();
      onTooBig(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 4 MB. Try a screenshot or a smaller photo.`);
      return;
    }
  }
  onTooBig("");
}
