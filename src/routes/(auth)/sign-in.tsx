import { LoginForm } from "@/modules/auth/login-form";
import { authService } from "@/services/auth.service";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/sign-in")({
  component: RouteComponent,
  beforeLoad: async () => {
    // Already signed in (e.g. the app restarted with a stored session): skip the sign-in screen.
    if (await authService.isSignedIn()) {
      throw redirect({ to: "/", replace: true });
    }
  },
});

function RouteComponent() {
  return <LoginForm />;
}
