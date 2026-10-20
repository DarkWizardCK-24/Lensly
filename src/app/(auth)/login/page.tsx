import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in · Lensly" };

export default function LoginPage() {
  return <AuthForm initialMode="login" />;
}
