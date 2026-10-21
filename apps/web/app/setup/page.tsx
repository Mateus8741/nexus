import { AuthLayout } from "@/components/auth/auth-layout";
import { SetupForm } from "./setup-form";

export default function SetupPage() {
  return (
    <AuthLayout title="Vamos começar" subtitle="Crie o Owner e o workspace padrão do Nexus.">
      <SetupForm />
    </AuthLayout>
  );
}
