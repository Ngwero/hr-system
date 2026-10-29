import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { updatePassword } from "@/server/auth";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-semibold">Choose a new password</h2>
      <div className="mt-8">
        <ActionForm action={updatePassword} submitLabel="Update password" successMessage="Password updated">
          <Field label="New password" name="password" type="password" minLength={8} required />
        </ActionForm>
      </div>
    </div>
  );
}
