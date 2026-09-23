import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      username: string;
      ageVerified: boolean;
      ageVerification: boolean;
      verificationStatus: string;
    };
  }

  interface User {
    username?: string;
    ageVerified?: boolean;
    ageVerification?: boolean;
    verificationStatus?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username?: string;
    role?: string;
    ageVerified?: boolean;
    ageVerification?: boolean;
    verificationStatus?: string;
  }
}
