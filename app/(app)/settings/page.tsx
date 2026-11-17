import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsClient } from "@/components/SettingsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { user } = getCurrentUser()!;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Account" title="Settings" subtitle="Manage your account, security and data." />
      <SettingsClient
        email={user.email}
        displayName={user.displayName || user.email}
        role={user.role}
        createdAt={user.createdAt}
      />
    </div>
  );
}
