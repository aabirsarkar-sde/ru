import { PhoneUpload } from "./PhoneUpload";

export const metadata = { title: "Upload from phone · Rishihood University" };

export default async function Page({ params }: PageProps<"/m/[token]">) {
  const { token } = await params;
  return <PhoneUpload token={token} />;
}
