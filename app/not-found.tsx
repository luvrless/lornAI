import Link from "next/link";
import { Icon, ICONS, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-5">
      <div className="grid-fade pointer-events-none absolute inset-x-0 top-0 h-[480px]" aria-hidden="true" />
      <div className="relative w-full max-w-md animate-rise text-center">
        <Link href="/" className="mb-10 inline-flex">
          <Logo size={32} />
        </Link>
        <div className="panel p-8 shadow-lift">
          <div className="text-gradient text-[64px] font-semibold leading-none tracking-tight">404</div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Page not found</h1>
          <p className="mt-2 text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/" className="btn-primary">
              <Icon d={ICONS.arrowLeft} className="h-4 w-4" strokeWidth={2.2} />
              Back home
            </Link>
            <Link href="/overview" className="btn">Open console</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
