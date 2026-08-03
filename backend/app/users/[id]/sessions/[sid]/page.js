import SessionView from "@/components/SessionView";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const { id, sid } = await params;
  return <SessionView userId={id} sessionId={sid} />;
}
