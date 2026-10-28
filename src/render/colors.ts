import pc from "picocolors";

export type Colors = ReturnType<typeof pc.createColors>;

export interface ColorEnvironment {
  flag: boolean;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
}

/** `--no-color` and a non-empty NO_COLOR always win; FORCE_COLOR beats a pipe. */
export function shouldUseColor({ flag, isTTY, env }: ColorEnvironment): boolean {
  if (!flag) return false;
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== "0") return true;
  return isTTY && env.TERM !== "dumb";
}

export function colors(enabled: boolean): Colors {
  return pc.createColors(enabled);
}
