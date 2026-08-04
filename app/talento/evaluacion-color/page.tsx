"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Enlaces antiguos → evaluación unificada. */
export default function EvaluacionColorRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const q = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`/talento/evaluacion${q}`);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">
      Redirigiendo a la evaluación…
    </main>
  );
}
