"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PatientFileMeta = {
  id: string;
  category: "BEFORE" | "AFTER" | "DOCUMENT" | "OTHER";
  fileName: string;
  mimeType: string;
  size: number;
  note: string | null;
  createdAt: string;
};

const categoryLabels: Record<PatientFileMeta["category"], string> = {
  BEFORE: "Tedavi öncesi",
  AFTER: "Tedavi sonrası",
  DOCUMENT: "Belge",
  OTHER: "Diğer"
};

const categoryTones: Record<PatientFileMeta["category"], "warning" | "success" | "default" | "muted"> = {
  BEFORE: "warning",
  AFTER: "success",
  DOCUMENT: "default",
  OTHER: "muted"
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function PatientFiles({ patientId, initialFiles, canDelete = false }: { patientId: string; initialFiles: PatientFileMeta[]; canDelete?: boolean }) {
  const [files, setFiles] = useState<PatientFileMeta[]>(initialFiles);
  const [category, setCategory] = useState<PatientFileMeta["category"]>("BEFORE");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const baseUrl = `/api/patients/${patientId}/files`;

  async function uploadBlob(blob: Blob, fileName: string) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("category", category);
      const response = await fetch(baseUrl, { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Dosya yüklenemedi.");
      setFiles((current) => [payload.file, ...current]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of selected) {
      await uploadBlob(file, file.name);
    }
  }

  async function removeFile(fileId: string) {
    if (!window.confirm("Bu dosya silinsin mi?")) return;
    const response = await fetch(`${baseUrl}/${fileId}`, { method: "DELETE" });
    if (response.ok) {
      setFiles((current) => current.filter((file) => file.id !== fileId));
    }
  }

  async function openCamera() {
    setCameraError(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin veya \"Telefonla çek\" seçeneğini kullanın.");
    }
  }

  function startPhotoCapture() {
    // Android/iOS browsers and the ClinicNova WebView should invoke the native
    // camera intent. Desktop browsers keep the live in-page camera preview.
    const nativeMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
    if (nativeMobile) captureInputRef.current?.click();
    else void openCamera();
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraError(null);
  }

  useEffect(() => closeCamera, []);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    closeCamera();
    await uploadBlob(blob, `kamera-${stamp}.jpg`);
  }

  const beforeFiles = files.filter((file) => file.category === "BEFORE");
  const afterFiles = files.filter((file) => file.category === "AFTER");
  const otherFiles = files.filter((file) => file.category === "DOCUMENT" || file.category === "OTHER");

  function renderFileCard(file: PatientFileMeta) {
    const isImage = file.mimeType.startsWith("image/");
    const fileUrl = `${baseUrl}/${file.id}`;
    return (
      <div key={file.id} className="group relative overflow-hidden rounded-md border bg-background">
        <a href={fileUrl} target="_blank" rel="noreferrer" className="block">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={file.fileName} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
              <FileText className="h-8 w-8" />
              <span className="max-w-full truncate px-2 text-xs">{file.fileName}</span>
            </div>
          )}
        </a>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <div className="min-w-0">
            <Badge variant={categoryTones[file.category]}>{categoryLabels[file.category]}</Badge>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {new Date(file.createdAt).toLocaleDateString("tr-TR")} · {formatSize(file.size)}
            </p>
          </div>
          {canDelete ? <Button type="button" variant="ghost" size="sm" className="shrink-0 text-destructive" onClick={() => removeFile(file.id)} aria-label="Dosyayı sil">
            <Trash2 className="h-4 w-4" />
          </Button> : null}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-accent" />
          Hasta dosyaları ve önce/sonra fotoğrafları
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-3">
          <div className="space-y-2">
            <Label htmlFor="file-category">Kategori</Label>
            <Select id="file-category" value={category} onChange={(event) => setCategory(event.target.value as PatientFileMeta["category"])}>
              <option value="BEFORE">Tedavi öncesi</option>
              <option value="AFTER">Tedavi sonrası</option>
              <option value="DOCUMENT">Belge</option>
              <option value="OTHER">Diğer</option>
            </Select>
          </div>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Dosya yükle
          </Button>
          <Button type="button" disabled={uploading} onClick={startPhotoCapture}>
            <Camera className="h-4 w-4" />
            Fotoğraf çek
          </Button>
          {uploading ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Yükleniyor…
            </span>
          ) : null}
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileChange} />
          <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
        </div>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {cameraOpen ? (
          <div className="space-y-3 rounded-md border bg-background p-3">
            {cameraError ? (
              <p className="text-sm text-red-600">{cameraError}</p>
            ) : (
              <video ref={videoRef} playsInline muted className="max-h-[420px] w-full rounded-md bg-black object-contain" />
            )}
            <div className="flex flex-wrap gap-2">
              {!cameraError ? (
                <Button type="button" onClick={capturePhoto} disabled={uploading}>
                  <Camera className="h-4 w-4" />
                  Çek ve kaydet ({categoryLabels[category]})
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={closeCamera}>
                <X className="h-4 w-4" />
                Kapat
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Tedavi öncesi ({beforeFiles.length})</h3>
            <div className={cn("grid gap-3", beforeFiles.length > 0 ? "grid-cols-2 xl:grid-cols-3" : "")}>
              {beforeFiles.length > 0 ? beforeFiles.map(renderFileCard) : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Henüz tedavi öncesi fotoğraf yok.</p>}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Tedavi sonrası ({afterFiles.length})</h3>
            <div className={cn("grid gap-3", afterFiles.length > 0 ? "grid-cols-2 xl:grid-cols-3" : "")}>
              {afterFiles.length > 0 ? afterFiles.map(renderFileCard) : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Henüz tedavi sonrası fotoğraf yok.</p>}
            </div>
          </div>
        </div>

        {otherFiles.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Diğer dosyalar ({otherFiles.length})</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">{otherFiles.map(renderFileCard)}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
