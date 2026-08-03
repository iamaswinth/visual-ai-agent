import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main style={{ display: "flex", justifyContent: "center", padding: "72px 16px" }}>
      <SignUp />
    </main>
  );
}
