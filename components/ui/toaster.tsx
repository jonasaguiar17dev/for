"use client";

import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";

/** Notificações no padrão visual do sistema. */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      gap={8}
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        error: <CircleAlert className="size-4 text-danger" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        info: <Info className="size-4 text-info" />,
        loading: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-card !text-foreground !shadow-lg !font-sans !text-[13px] !gap-2.5 !py-3",
          description: "!text-muted-foreground",
          closeButton: "!bg-card !border-border",
        },
      }}
    />
  );
}
