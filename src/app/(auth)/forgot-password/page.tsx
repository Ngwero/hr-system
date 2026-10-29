import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { requestPasswordReset } from "@/server/auth";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-semibold">Reset your password</h2>
      <p className="mt-2 text-sm text-muted-foreground">We will email a link that expires with your auth settings.</p>
      <div className="mt-8">
        <ActionForm action={requestPasswordReset} submitLabel="Send reset link" pendingLabel="Sending…" successMessage="Reset link sent">
          <Field label="Email" name="email" type="email" required />
        </ActionForm>
      </div>
      <Link href="/login" className="mt-6 inline-block text-sm text-brand">Back to sign in</Link>
    </div>
  );
}
