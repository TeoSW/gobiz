import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { FileText, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api, getStoredUserId } from "../lib/api";
import { texts, useTexts } from "../lib/i18n";
import { Badge, ErrorBox } from "./ui";

const ACCEPT = ".pdf,.doc,.docx,.odt";
const MAX_MB = 5;

const T = texts(
  {
    wrongType: "Please choose a PDF, DOC, DOCX or ODT file.",
    tooBig: `The file is larger than ${MAX_MB} MB.`,
    title: "Your CV",
    sub: "Companies can open it from your profile.",
    uploaded: "Uploaded",
    open: "Open",
    replace: "Replace",
    remove: "Remove CV",
    uploading: "Uploading...",
    drop: "Drag your CV here, or click to choose a file",
    formats: `PDF, DOC, DOCX or ODT, up to ${MAX_MB} MB`,
    fillTitle: "Fill my profile from my CV",
    soon: "Coming soon",
    fillText: "AI will read your CV and fill in your skills, courses and projects. You check everything before saving.",
    fillButton: "Fill from CV",
  },
  {
    wrongType: "Alege un fișier PDF, DOC, DOCX sau ODT.",
    tooBig: `Fișierul are mai mult de ${MAX_MB} MB.`,
    title: "CV-ul tău",
    sub: "Companiile îl pot deschide din profilul tău.",
    uploaded: "Încărcat",
    open: "Deschide",
    replace: "Înlocuiește",
    remove: "Șterge CV-ul",
    uploading: "Se încarcă...",
    drop: "Trage CV-ul aici sau apasă ca să alegi un fișier",
    formats: `PDF, DOC, DOCX sau ODT, până la ${MAX_MB} MB`,
    fillTitle: "Completează profilul din CV",
    soon: "În curând",
    fillText: "AI-ul va citi CV-ul și îți va completa abilitățile, materiile și proiectele. Tu verifici totul înainte de salvare.",
    fillButton: "Completează din CV",
  },
);

/** Original file name (the server stores it as cv_<userId>_<name>). */
const displayName = (stored: string) => stored.split("_").slice(2).join("_") || stored;

export function CvUpload({ studentId, cvFilename }: { studentId: number; cvFilename: string }) {
  const t = useTexts(T);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["student-me"] });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api("/students/me/cv", { method: "POST", body: fd });
    },
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: () => api("/students/me/cv", { method: "DELETE" }), onSuccess: refresh });

  const pick = (file: File | undefined) => {
    setLocalError(null);
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPT.split(",").includes(ext)) return setLocalError(t.wrongType);
    if (file.size > MAX_MB * 1024 * 1024) return setLocalError(t.tooBig);
    upload.mutate(file);
  };

  const open = async () => {
    const res = await fetch(`/api/students/${studentId}/cv`, { headers: { "X-User-Id": String(getStoredUserId()) } });
    window.open(URL.createObjectURL(await res.blob()), "_blank", "noopener");
  };

  return (
    <section className="card space-y-4 p-6" aria-labelledby="cv-title">
      <div>
        <h2 id="cv-title" className="text-lg font-bold">
          {t.title}
        </h2>
        <p className="text-muted-fg">{t.sub}</p>
      </div>

      {cvFilename ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 p-4">
          <FileText className="size-8 text-primary-strong" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{displayName(cvFilename)}</p>
            <p className="text-sm text-muted-fg">{t.uploaded}</p>
          </div>
          <button type="button" className="btn-outline min-h-10" onClick={open}>
            {t.open}
          </button>
          <button type="button" className="btn-outline min-h-10" onClick={() => input.current?.click()} disabled={upload.isPending}>
            <RefreshCw className="size-4" aria-hidden /> {t.replace}
          </button>
          <button type="button" className="btn-danger min-h-10" onClick={() => remove.mutate()} disabled={remove.isPending} aria-label={t.remove}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={clsx(
            "flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragging ? "border-primary bg-primary-soft/50" : "border-border hover:border-primary hover:bg-muted/60",
          )}
        >
          <Upload className="size-8 text-primary-strong" aria-hidden />
          <span className="font-semibold">{upload.isPending ? t.uploading : t.drop}</span>
          <span className="text-sm text-muted-fg">{t.formats}</span>
        </button>
      )}
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      {localError && <ErrorBox error={localError} />}
      <ErrorBox error={upload.error || remove.error} />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
        <Sparkles className="size-5 text-primary-strong" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {t.fillTitle} <Badge tone="warning">{t.soon}</Badge>
          </p>
          <p className="text-sm text-muted-fg">{t.fillText}</p>
        </div>
        <button type="button" className="btn-outline" disabled title={t.soon}>
          {t.fillButton}
        </button>
      </div>
    </section>
  );
}
