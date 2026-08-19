import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage(): React.JSX.Element {
  return (
    <AuthCard title="Log in" subtitle="Welcome back to Tesoro.">
      <LoginForm />
      <p className="mt-6 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href="/register" className="text-market underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
