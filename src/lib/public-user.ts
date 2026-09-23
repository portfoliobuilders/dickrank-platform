import type { Role, VerificationStatus } from '@prisma/client';

export type PublicUser = {
  id: string;
  username: string;
  role: Role;
  verificationStatus: VerificationStatus;
  ageVerification: boolean;
  emailVerified: boolean;
  createdAt: string;
};

export function toPublicUser(user: {
  id: string;
  username: string;
  role: Role;
  verificationStatus: VerificationStatus;
  ageVerification: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    verificationStatus: user.verificationStatus,
    ageVerification: user.ageVerification === true,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
