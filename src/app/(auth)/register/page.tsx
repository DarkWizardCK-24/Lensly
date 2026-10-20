import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Create account · Lensly" };

export default function RegisterPage() {
  return <AuthForm initialMode="register" />;
}
