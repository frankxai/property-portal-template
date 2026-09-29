"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

const authClient = createAuthClient({ plugins: [genericOAuthClient()] });

export function OidcSignInButton({ providerId, nextPath }: { providerId: string; nextPath: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    const result = await authClient.signIn.oauth2({
      providerId,
      callbackURL: nextPath,
      errorCallbackURL: "/admin/sign-in?error=oidc",
      // Better Auth may create its protocol user only after the server verifies a pre-bound local membership.
      requestSignUp: true
    });
    if (result.error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="stack">
      <button className="button" type="button" onClick={signIn} disabled={pending}>
        {pending ? "Opening identity provider..." : "Continue with secure sign-in"}
      </button>
      {failed ? <p className="error-text">Secure sign-in could not start. Try again or contact the property administrator.</p> : null}
    </div>
  );
}
