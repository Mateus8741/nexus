import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<p>Carregando...</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
