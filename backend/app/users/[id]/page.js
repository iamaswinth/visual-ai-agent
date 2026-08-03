import UserView from "@/components/UserView";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const { id } = await params;
  return <UserView userId={id} />;
}
