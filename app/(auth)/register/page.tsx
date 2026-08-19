import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage(): React.JSX.Element {
  return (
    <AuthCard title="Create account" subtitle="Buy today, and sell whenever you're ready.">
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="text-market underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
