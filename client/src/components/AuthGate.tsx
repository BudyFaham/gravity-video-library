import { FormEvent, useEffect, useState } from "react";
import { Clock3, LockKeyhole, Loader2, LogIn } from "lucide-react";

const logoPath = "/gravity-logo.png";
type AuthState = "checking" | "login" | "pending" | "authenticated";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [displayName, setDisplayName] = useState(""); const [password, setPassword] = useState(""); const [remember, setRemember] = useState(false);
  const [requestId, setRequestId] = useState(""); const [pendingMessage, setPendingMessage] = useState(""); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);

  useEffect(() => { let cancelled = false; fetch("/api/auth/session", { credentials: "include" }).then(response => { if (!cancelled) setState(response.ok ? "authenticated" : "login"); }).catch(() => { if (!cancelled) { setError("تعذر الاتصال بالخادم. حاول مرة أخرى."); setState("login"); } }); return () => { cancelled = true; }; }, []);

  useEffect(() => {
    if (state !== "authenticated") return;
    const timer = window.setInterval(async () => {
      try { const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" }); if (response.status === 401) setState("login"); }
      catch { /* لا نطرد المستخدم بسبب انقطاع عابر؛ الفحص التالي سيحاول مجددًا */ }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state !== "pending" || !requestId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/auth/request/${encodeURIComponent(requestId)}`, { credentials: "include", cache: "no-store" });
        const data = await response.json() as { status?: string; authenticated?: boolean; message?: string };
        if (cancelled) return;
        if (data.status === "approved" && data.authenticated) { setState("authenticated"); setPendingMessage(""); return; }
        if (data.status === "denied") { setPendingMessage(data.message || "تم رفض الطلب."); setState("login"); setRequestId(""); return; }
        window.setTimeout(poll, 3000);
      } catch { if (!cancelled) window.setTimeout(poll, 4000); }
    };
    void poll(); return () => { cancelled = true; };
  }, [state, requestId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError(""); setPendingMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, password, remember }) });
      const data = await response.json().catch(() => ({})) as { requestId?: string; error?: string };
      if (response.status === 202 && data.requestId) { setRequestId(data.requestId); setState("pending"); setPassword(""); return; }
      setError(response.status === 429 ? "تم إيقاف المحاولات مؤقتًا بعد 8 محاولات فاشلة. حاول بعد 15 دقيقة." : "اسم المستخدم أو كلمة السر غير صحيحة.");
    } catch { setError("تعذر الاتصال بالخادم. حاول مرة أخرى."); } finally { setSubmitting(false); }
  }

  if (state === "checking") return <div className="flex min-h-screen items-center justify-center bg-[#070a16] text-[#d1ff68]" dir="rtl"><Loader2 className="h-7 w-7 animate-spin" aria-label="جارٍ التحقق" /></div>;
  if (state === "authenticated") return <>{children}</>;
  if (state === "pending") return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070a16] px-4 py-10 text-white" dir="rtl"><div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0e1326]/90 p-9 text-center shadow-2xl"><img src={logoPath} alt="Gravity" className="mx-auto mb-8 h-12 w-auto object-contain" /><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d1ff68]/20 bg-[#d1ff68]/10 text-[#d1ff68]"><Clock3 className="h-7 w-7 animate-pulse" /></div><h1 className="font-display text-2xl font-black">طلبك قيد المراجعة</h1><p className="mt-3 text-sm leading-7 text-[#aeb2c9]">تم إرسال بيانات الدخول إلى صاحب المكتبة. ستفتح المكتبة تلقائيًا بعد الموافقة.</p><button onClick={() => { setState("login"); setRequestId(""); }} className="mt-7 rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-[#c4bfff] hover:bg-white/5">إلغاء الطلب</button></div></main>;

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070a16] px-4 py-10 text-white" dir="rtl"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(112,88,255,0.18),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(209,255,104,0.09),transparent_30%)]" /><section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0e1326]/90 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9"><div className="mb-8 text-center"><img src={logoPath} alt="Gravity" className="mx-auto mb-7 h-12 w-auto object-contain" /><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d1ff68]/20 bg-[#d1ff68]/10 text-[#d1ff68]"><LockKeyhole className="h-6 w-6" /></div><h1 className="font-display text-2xl font-black">المكتبة الخاصة</h1><p className="mt-2 text-sm text-[#8f93ac]">اكتب اسمك الحقيقي وكلمة السر وانتظر الموافقة</p></div><form className="space-y-4" onSubmit={submit}><label className="block text-sm font-bold text-[#d9dcf0]">اسمك الحقيقي<input value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" required placeholder="مثال: أحمد محمد" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#080b18] px-4 text-right text-white outline-none focus:border-[#d1ff68]/70" /></label><label className="block text-sm font-bold text-[#d9dcf0]">كلمة السر<input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" required className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#080b18] px-4 text-left text-white outline-none focus:border-[#d1ff68]/70" dir="ltr" /></label><label className="flex cursor-pointer items-center gap-2 text-sm text-[#aeb2c9]"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} className="h-4 w-4 accent-[#d1ff68]" /><span>تذكرني على هذا الجهاز</span></label>{error || pendingMessage ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200" role="alert">{error || pendingMessage}</p> : null}<button type="submit" disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d1ff68] font-black text-[#11170b] hover:bg-[#e0ff9c] disabled:cursor-wait disabled:opacity-60">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}إرسال طلب الدخول</button></form><p className="mt-6 text-center text-[11px] leading-5 text-[#707792]">لن يتم فتح المكتبة إلا بعد موافقة صاحبها.</p></section></main>;
}
