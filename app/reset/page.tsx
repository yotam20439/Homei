import { ResetForm } from "../login/AuthForms";

export default function ResetPage() {
  return (
    <main className="auth">
      <div className="brand">HOMEi</div>
      <h1 className="auth-title">איפוס סיסמה</h1>
      <ResetForm />
    </main>
  );
}
