export default function Privacy() {
  return (
    <main className="auth">
      <div className="brand">HOMEi</div>
      <h1 className="auth-title">פרטיות ואבטחה</h1>
      <p className="muted">[טיוטה: יש להשלים מדיניות פרטיות מלאה עם ייעוץ משפטי לפני השקה.]</p>
      <ul className="fine">
        <li>הכניסה מתבצעת עם אימייל וסיסמה, ובכל מכשיר חדש נדרש קוד אימות שנשלח למייל.</li>
        <li>הנתונים והמסמכים נשמרים בשרתי Supabase, וגישה אליהם מוגבלת ברמת מסד הנתונים לבני הבית בלבד.</li>
        <li>מסמכים שנסרקים נשלחים לזיהוי אוטומטי ב-Claude API של Anthropic.</li>
        <li>אפשר לנתק מכשירים, להסיר בני בית ולמחוק חשבונות ומסמכים מתוך ההגדרות.</li>
      </ul>
    </main>
  );
}
