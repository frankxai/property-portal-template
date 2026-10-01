"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

export function OwnerSignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/admin/sign-in");
        }
      }
    });
    setPending(false);
  }

  return (
    <button className="button-secondary" type="button" onClick={signOut} disabled={pending}>
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
