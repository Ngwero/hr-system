"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SecurityPanel({ required }: { required: boolean }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function enroll() {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      toast.error(error?.message ?? "Could not start enrolment");
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  }

  async function verify() {
    if (!factorId) return;
    const supabase = createBrowserSupabase();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      toast.error(challenge.error?.message ?? "Could not challenge this factor");
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verified.error) {
      toast.error(verified.error.message);
      return;
    }
    toast.success("Second factor enabled");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      {required ? <p className="text-sm">Sign-in is not complete until this factor is verified.</p> : null}
      <Button type="button" onClick={enroll}>Set up authenticator app</Button>
      {qr ? <img src={qr} alt="Authenticator QR code" className="h-48 w-48 rounded-lg border bg-white p-2" /> : null}
      {factorId ? (
        <div className="flex gap-2">
          <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit code" inputMode="numeric" />
          <Button type="button" onClick={verify}>Verify</Button>
        </div>
      ) : null}
    </div>
  );
}
