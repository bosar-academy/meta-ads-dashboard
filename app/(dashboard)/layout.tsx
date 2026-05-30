import { PasswordGate } from "@/components/password-gate";
import { TopBar } from "@/components/top-bar";

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <PasswordGate>
      <div className="min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-screen-2xl w-full mx-auto">
          {children}
        </main>
      </div>
    </PasswordGate>
  );
}
