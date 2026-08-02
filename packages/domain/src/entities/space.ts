export interface Space {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly parentId?: string;
  readonly createdAt: Date;
}
