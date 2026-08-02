export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly image?: string;
  readonly createdAt: Date;
}
