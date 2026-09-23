import { safeAvatarUrl } from "@/lib/avatar";

export type PublicRater = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

/** Anonymous reviews stay public, but the member behind them is not. */
export function presentRater(
  anonymous: boolean,
  user: { id: string; username: string; avatarUrl: string | null },
): PublicRater | null {
  if (anonymous) return null;
  return {
    id: user.id,
    username: user.username,
    avatarUrl: safeAvatarUrl(user.avatarUrl),
  };
}
