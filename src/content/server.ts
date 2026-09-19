import { notFound } from "next/navigation";
import { PROGRAM_IDS, loadProgram, loadProgramGames, loadRubrics } from "./load";

/** Everything a program's pages need, loaded server-side and passed to the client. */
export function programBundle(id: string) {
  if (!(PROGRAM_IDS as readonly string[]).includes(id)) notFound();
  const program = loadProgram(id);
  return { program, games: loadProgramGames(program), rubrics: loadRubrics() };
}

export type ProgramBundle = ReturnType<typeof programBundle>;

export function generateProgramParams() {
  return PROGRAM_IDS.map((program) => ({ program }));
}
