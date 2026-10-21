import { Suspense } from "react";

import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthLayout title="Bem-vindo de volta" subtitle="Entre para controlar seus ambientes.">
      <Suspense fallback={<div className="skeleton h-40 rounded-xl" />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
