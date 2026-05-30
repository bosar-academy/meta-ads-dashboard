"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /login is the password gate landing. The PasswordGate component renders inline
// on the dashboard layout, so /login just redirects to / where the gate handles auth.
export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
