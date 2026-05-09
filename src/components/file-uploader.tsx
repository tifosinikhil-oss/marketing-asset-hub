"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordUploadedFile } from "@/server/actions/files";

interface FileUploaderProps {
  requestId: string;
  kind?: "REFERENCE" | "RESEARCH" | "DRAFT" | "DESIGN" | "FINAL";
  label?: string;
}

export function FileUploader({ requestId, kind = "REFERENCE", label = "Upload" }: FileUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setProgress({ name: file.name, pct: 0 });

    startTransition(async () => {
      try {
        const presignRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            requestId,
          }),
        });
        if (!presignRes.ok) {
          const { error: msg } = (await presignRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(msg ?? `Upload not available (HTTP ${presignRes.status})`);
        }
        const { url, key } = (await presignRes.json()) as { url: string; key: string };

        await uploadWithProgress(url, file, (pct) => setProgress({ name: file.name, pct }));

        await recordUploadedFile({
          requestId,
          filename: file.name,
          r2Key: key,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          kind,
        });

        setProgress(null);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
        setProgress(null);
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
        disabled={pending}
      />
      <Button type="button" variant="outline" size="sm" onClick={pick} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {label}
      </Button>

      {progress && (
        <div className="text-xs text-[var(--color-muted-foreground)]">
          {progress.name} · {progress.pct}%
        </div>
      )}
      {error && (
        <div className="text-xs text-[var(--color-destructive)] flex items-center gap-1">
          <X className="size-3" /> {error}
        </div>
      )}
    </div>
  );
}

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}
