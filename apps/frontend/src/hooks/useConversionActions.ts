import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { conversionsApi } from "@/lib/api";
import type { ConversionSummary } from "@/types/conversion";

export function useConversionActions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["conversions"] });

  async function cancel(conversionId: string) {
    try {
      await conversionsApi.cancel(conversionId);
      toast.success("Conversão cancelada");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao cancelar");
    }
  }

  async function remove(conversionId: string) {
    try {
      await conversionsApi.remove(conversionId);
      toast.success("Conversão removida");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao remover");
    }
  }

  async function download(conversionId: string, jobId: string) {
    try {
      const token = localStorage.getItem("mangaink_token");
      const url = `/api/conversions/${conversionId}/jobs/${jobId}/download`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error ?? "Erro ao baixar arquivo");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch?.[1] ?? "download";
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = decodeURIComponent(filename);
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success("Download iniciado");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao baixar");
    }
  }

  async function reconvert(conversionId: string) {
    try {
      const state = await conversionsApi.get(conversionId);
      const config = state.config as any;
      navigate({
        to: "/wizard",
        search: { sourceId: config.sourceId, conversionId },
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao reconverter");
    }
  }

  return { cancel, remove, download, reconvert };
}
