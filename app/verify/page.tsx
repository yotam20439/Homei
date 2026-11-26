import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/device";
import VerifyForm from "./VerifyForm";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const next = safeNext((await searchParams).next);
  return (
    <main className="auth">
      <div className="brand">HOMEi</div>
      <h1 className="auth-title">אימות המכשיר</h1>
      <VerifyForm email={user.email} next={next} />
      <form action="/auth/signout" method="post"><button className="link-btn">כניסה עם משתמש אחר</button></form>
    </main>
  );
}
