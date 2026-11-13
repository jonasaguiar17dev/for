"use client";

import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteDocument,
  finalizeDocumentUpload,
  getDocumentUrl,
  prepareDocumentUpload,
} from "@/app/(app)/clientes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "@/schemas/organization";
import type { ClientDocumentRow } from "@/types/database";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, type DocumentType } from "@/types/domain";
import { formatBytes, formatDateTime } from "@/utils/format";

export function DocumentsPanel({
  companyId,
  documents,
  canWrite,
}: {
  companyId: string;
  documents: ClientDocumentRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType>("contrato_social");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Selecione um arquivo.");
    if (file.size > MAX_DOCUMENT_BYTES) return toast.error("O arquivo excede o limite de 10 MB.");
    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      return toast.error("Tipo de arquivo não permitido.");
    }

    const meta = {
      document_type: type,
      document_name: name.trim() || file.name,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    };
    setUploading(true);
    try {
      const prepared = await prepareDocumentUpload(companyId, meta);
      if (!prepared.ok) return void toast.error(prepared.error);

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("client-documents")
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type });
      if (error) return void toast.error("Falha ao enviar o arquivo.");

      const done = await finalizeDocumentUpload(companyId, prepared.data.path, meta);
      if (!done.ok) return void toast.error(done.error);

      toast.success(done.message ?? "Documento enviado.");
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleDownload(id: string) {
    startTransition(async () => {
      const result = await getDocumentUrl(id);
      if (!result.ok) return void toast.error(result.error);
      window.location.assign(result.data.url);
    });
  }

  function handleDelete(doc: ClientDocumentRow) {
    if (!window.confirm(`Excluir o documento "${doc.document_name}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const result = await deleteDocument(doc.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Documento excluído.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      {canWrite && (
        <form onSubmit={handleUpload} className="grid gap-4 rounded-lg border border-dashed p-4 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="doc-type">Tipo</Label>
            <NativeSelect id="doc-type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="doc-name">Nome (opcional)</Label>
            <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="doc-file">Arquivo (até 10 MB)</Label>
            <Input
              id="doc-file"
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.xml"
              className="pt-1.5"
            />
          </div>
          <Button type="submit" disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            Enviar
          </Button>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum documento enviado.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <FileText className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.document_name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_TYPE_LABELS[doc.document_type]} · {formatBytes(doc.size_bytes)} · {formatDateTime(doc.created_at)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleDownload(doc.id)} disabled={pending}>
                <Download /> Baixar
              </Button>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc)}
                  disabled={pending}
                  aria-label={`Excluir ${doc.document_name}`}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
