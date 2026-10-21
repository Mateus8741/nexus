import { AuthLayout } from "@/components/auth/auth-layout";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Criar conta · Nexus" };

export default function CadastroPage() {
  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="A conta dá acesso ao app e aos downloads. O acesso aos dispositivos depende de convite do administrador."
    >
      <SignupForm />
    </AuthLayout>
  );
}
