"use client";

import { toast } from "sonner";
import { revokeRole, setMemberStatus } from "@/server/access";

export function MemberActions({
  userId,
  status,
  assignmentIds,
  isSelf,
}: {
  userId: string;
  status: string;
  assignmentIds: string[];
  isSelf: boolean;
}) {
  return (
    <div className="flex justify-end gap-3">
      {!isSelf ? (
        <button
          type="button"
          className="text-sm text-brand"
          onClick={async () => {
            const result = await setMemberStatus(userId, status === "active" ? "suspended" : "active");
            if (!result.ok) toast.error(result.error);
            else toast.success(status === "active" ? "Access suspended" : "Access restored");
          }}
        >
          {status === "active" ? "Suspend" : "Restore"}
        </button>
      ) : null}
      {assignmentIds[0] ? (
        <button
          type="button"
          className="text-sm text-destructive"
          onClick={async () => {
            const result = await revokeRole(assignmentIds[0]);
            if (!result.ok) toast.error(result.error);
            else toast.success("Role removed");
          }}
        >
          Remove role
        </button>
      ) : null}
    </div>
  );
}
