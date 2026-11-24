import { LoginForm } from "@/modules/auth/login-form";
import { authService } from "@/services/auth.service";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/sign-in")({
  component: RouteComponent,
  beforeLoad: async () => {
    if (await authService.isSignedIn()) {
      throw redirect({ to: "/", replace: true });
    }
  },
});

function RouteComponent() {
  return <LoginForm />;
}
