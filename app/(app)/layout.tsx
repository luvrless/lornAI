import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getCurrentUser();
  if (!session) {
    redirect("/login");
    return null;
  }
  const { user } = session;
  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={user.role}
        email={user.email}
        displayName={user.displayName || user.email}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[264px]">
        <main className="flex-1 px-4 pb-16 pt-6 sm:px-8 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
