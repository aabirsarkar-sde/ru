import { programBundle } from "@/content/server";
import { Runner } from "./Runner";

export const metadata = { title: "Test in progress · Rishihood University" };

export default async function Page({ params }: PageProps<"/[program]/test">) {
  const { program, games } = programBundle((await params).program);
  return <Runner program={program} games={games} />;
}
