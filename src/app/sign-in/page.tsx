import { signIn } from "@/auth";
import { Sparkles } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="size-6 text-[var(--color-primary)]" />
          <h1 className="text-2xl font-semibold tracking-tight">Marketing Asset Hub</h1>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Brief, build, ship, and search every marketing asset.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-md py-2.5 text-sm font-medium hover:opacity-90"
          >
            Sign in with Microsoft
          </button>
        </form>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Restricted to your organization&apos;s Entra tenant.
        </p>
      </div>
    </div>
  );
}
