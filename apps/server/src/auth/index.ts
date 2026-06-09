import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "../db";

export interface AuthResult {
  ok: true;
  accountId: string;
  username: string;
}

export interface AuthError {
  ok: false;
  error: string;
}

export async function verifyToken(token: string): Promise<AuthResult | AuthError> {
  if (!token) {
    return { ok: false, error: "missing token" };
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false, error: error?.message || "invalid token" };
  }

  const username = data.user.email ?? data.user.phone ?? data.user.id;

  return {
    ok: true,
    accountId: data.user.id,
    username,
  };
}
