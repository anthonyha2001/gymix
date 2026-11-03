import Link from "next/link";
import { Logo } from "@/components/ui";
import { signOut } from "../(auth)/actions";

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/portal">
            <Logo />
          </Link>
          <form action={signOut}>
            <button className="rounded-lg px-3 h-9 text-sm text-muted hover:bg-canvas hover:text-ink">Log out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
