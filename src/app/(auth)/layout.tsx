import { AuthBrandPanel } from "@/components/auth-form";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <AuthBrandPanel />
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">{children}</main>
    </div>
  );
}
