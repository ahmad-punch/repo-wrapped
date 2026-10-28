export interface FileChange {
  path: string;
  added: number;
  deleted: number;
  binary: boolean;
}

export interface Commit {
  hash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  /** Author date in strict ISO 8601, in the author's own timezone. */
  authorDate: string;
  message: string;
  files: FileChange[];
}

export interface LogOptions {
  since?: string;
  until?: string;
  author?: string;
  branch?: string;
}
