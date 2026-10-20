"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/** Client-side route guard. Real authorization is enforced by the API on every request. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  if (status === "signedIn" || status === "demo") return <>{children}</>;
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-5">
        <Image src="/brand/logo.svg" alt="" width={72} height={72} priority />
        <span className="size-7 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand" />
      </div>
    </div>
  );
}
