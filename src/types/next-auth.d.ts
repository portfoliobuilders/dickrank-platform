import type { VerificationStatus } from "@/lib/schemas";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      username: string;
      verificationStatus: VerificationStatus;
      ageVerified: boolean;
      emailVerified: boolean;
    };
  }

  interface User {
    id: string;
    username: string;
    verificationStatus: VerificationStatus;
    ageVerified: boolean;
    emailVerified: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    verificationStatus: VerificationStatus;
    ageVerified: boolean;
    emailVerified: boolean;
  }
}
