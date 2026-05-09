import { signIn } from "@/auth";
import { Sparkles } from "lucide-react";

export default function SignInPage() {
  const devAuth = process.env.DEV_AUTH === "true";

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

        {devAuth ? (
          <form
            action={async (formData) => {
              "use server";
              await signIn("dev", { email: formData.get("email"), redirectTo: "/dashboard" });
            }}
            className="space-y-3 text-left"
          >
            <label className="text-xs text-[var(--color-muted-foreground)] block">
              Demo email
              <input
                type="email"
                name="email"
                defaultValue={process.env.DEV_AUTH_EMAIL ?? "admin@demo.local"}
                className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              />
            </label>
            <button
              type="submit"
              className="w-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-md py-2.5 text-sm font-medium hover:opacity-90"
            >
              Continue (dev)
            </button>
            <p className="text-xs text-[var(--color-muted-foreground)] text-center">
              Local development mode — no Entra required.
            </p>
          </form>
        ) : (
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
            <p className="text-xs text-[var(--color-muted-foreground)] mt-3">
              Restricted to your organization&apos;s Entra tenant.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
