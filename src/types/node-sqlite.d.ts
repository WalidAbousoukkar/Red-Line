declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export interface StatementSync {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number };
  }
}
