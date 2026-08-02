export interface Membership {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly createdAt: Date;
}
