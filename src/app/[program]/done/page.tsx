import { programBundle } from "@/content/server";
import { Done } from "./Done";

export const metadata = { title: "Test submitted · Rishihood University" };

export default async function Page({ params }: PageProps<"/[program]/done">) {
  const { program } = programBundle((await params).program);
  return <Done program={program} />;
}
