import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Loader2, LockKeyhole, LogIn, LogOut, RefreshCw, ShieldAlert, Trash2, UserRound, XCircle } from "lucide-react";
import { Link } from "wouter";
import VideoManagerPanel from "@/components/VideoManagerPanel";
import type { CustomVideo } from "@/lib/customVideos";

type Attempt = { id?: number; displayName: string; username: string; ipAddress: string; successful: number; reason: string; userAgent?: string | null; createdAt: string };
type LoginRequest = { id: string; displayName: string; username: string; ipAddress: string; userAgent?: string | null; remember: number; createdAt: string };
type Session = { id: string; displayName: string; username: string; ipAddress: string; userAgent?: string | null; remember: number; status: string; endReason?: string | null; expiresAt: string; endedAt?: string | null; createdAt: string };
type Summary = { total: number; successful: number; failed: number; pending: number };
type Activity = { id: string; displayName: string; ipAddress: string; createdAt: string; userAgent?: string | null; kind: "attempt" | "session"; attempt?: Attempt; session?: Session };

function reasonLabel(reason: string) {
  if (reason === "awaiting_approval") return "بانتظار الموافقة";
  if (reason === "denied") return "تم رفض الطلب";
  if (reason === "login_remembered") return "دخول ناجح — تذكرني";
  if (reason === "login") return "دخول ناجح";
  if (reason === "rate_limited") return "تم إيقاف المحاولة مؤقتًا";
  if (reason === "missing_name") return "الاسم غير موجود";
  return "بيانات الدخول غير صحيحة";
}

function sessionStatusLabel(session: Session) {
  if (session.status === "active" && new Date(session.expiresAt).getTime() <= Date.now()) return { label: "انتهت تلقائيًا", className: "text-amber-200", icon: <Clock3 className="ml-1 inline h-4 w-4" /> };
  if (session.status === "active") return { label: "نشطة", className: "text-[#d1ff68]", icon: <CheckCircle2 className="ml-1 inline h-4 w-4" /> };
  if (session.status === "logged_out" || session.endReason === "logout") return { label: "سجّل خروج", className: "text-[#aeb2c9]", icon: <LogOut className="ml-1 inline h-4 w-4" /> };
  if (session.status === "terminated" || session.endReason === "admin_terminated") return { label: "تم إنهاؤها من الإدارة", className: "text-red-200", icon: <CircleAlert className="ml-1 inline h-4 w-4" /> };
  if (new Date(session.expiresAt).getTime() <= Date.now()) return { label: "انتهت تلقائيًا", className: "text-amber-200", icon: <Clock3 className="ml-1 inline h-4 w-4" /> };
  return { label: "غير معروفة", className: "text-[#aeb2c9]", icon: <CircleAlert className="ml-1 inline h-4 w-4" /> };
}

function browserLabel(userAgent?: string | null) {
  if (!userAgent) return "غير متاح";
  const browser = userAgent.includes("Edg/") ? "Microsoft Edge" : userAgent.includes("OPR/") ? "Opera" : userAgent.includes("Firefox/") ? "Firefox" : userAgent.includes("Chrome/") ? "Google Chrome" : userAgent.includes("Safari/") ? "Safari" : userAgent.includes("SamsungBrowser/") ? "Samsung Internet" : "متصفح غير معروف";
  const device = /Android/i.test(userAgent) ? "Android" : /iPhone|iPad|iPod/i.test(userAgent) ? "iPhone/iPad" : /Windows/i.test(userAgent) ? "Windows" : /Macintosh|Mac OS/i.test(userAgent) ? "macOS" : /Linux/i.test(userAgent) ? "Linux" : "جهاز غير معروف";
  return `${browser} — ${device}`;
}

export default function AdminDashboard() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [requests, setRequests] = useState<LoginRequest[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, successful: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denyId, setDenyId] = useState("");
  const [denyMessage, setDenyMessage] = useState("تم رفض طلب الدخول.");
  const [adminState, setAdminState] = useState<"checking" | "login" | "authenticated">("checking");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [customVideos, setCustomVideos] = useState<CustomVideo[]>([]);
  const [videoManagerOpen, setVideoManagerOpen] = useState(false);

  async function api(path: string, options?: RequestInit) {
    const response = await fetch(path, { ...options, credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
    if (!response.ok) { const error = new Error(`request_${response.status}`) as Error & { status?: number }; error.status = response.status; throw error; }
    return response.json();
  }

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const data = await api("/api/auth/admin/dashboard") as { attempts?: Attempt[]; requests?: LoginRequest[]; sessions?: Session[]; sessionHistory?: Session[]; summary?: Summary };
      setAttempts(data.attempts ?? []);
      setRequests(data.requests ?? []);
      setSessions(data.sessions ?? []);
      setSessionHistory(data.sessionHistory ?? data.sessions ?? []);
      setSummary(data.summary ?? { total: data.attempts?.length ?? 0, successful: 0, failed: 0, pending: 0 });
    } catch (caught) {
      const error = caught as Error & { status?: number };
      if (error.status === 401) { setAdminState("login"); setError("انتهت جلسة لوحة التحكم. سجّل الدخول مرة أخرى."); }
      else setError("تعذر مزامنة بيانات الإدارة الآن. ستتم إعادة المحاولة تلقائيًا.");
    } finally { setLoading(false); }
  }
  async function loadCustomVideos() {
    const data = await api("/api/videos/custom") as { videos?: CustomVideo[] };
    setCustomVideos(Array.isArray(data.videos) ? data.videos : []);
  }

  useEffect(() => { void (async () => { try { await api("/api/auth/admin/requests"); setAdminState("authenticated"); await load(true); } catch { setAdminState("login"); setLoading(false); } })(); }, []);
  useEffect(() => { if (adminState !== "authenticated") return; void loadCustomVideos().catch(() => undefined); const timer = window.setInterval(() => void load(false), 5000); return () => window.clearInterval(timer); }, [adminState]);
  async function adminLogin(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setAdminSubmitting(true); setError(""); try { await api("/api/auth/admin/login", { method: "POST", body: JSON.stringify({ username: adminUsername, password: adminPassword }) }); setAdminPassword(""); setAdminState("authenticated"); await load(true); } catch { setError("بيانات المالك غير صحيحة."); } finally { setAdminSubmitting(false); } }
  async function approve(id: string) { await api(`/api/auth/admin/requests/${id}/approve`, { method: "POST" }); await load(); }
  async function deny(id: string) { await api(`/api/auth/admin/requests/${id}/deny`, { method: "POST", body: JSON.stringify({ message: denyMessage }) }); setDenyId(""); await load(); }
  async function revoke(id: string) { await api(`/api/auth/admin/sessions/${id}/revoke`, { method: "POST" }); await load(); }
  async function revokeAll() { if (window.confirm("إنهاء جميع الجلسات النشطة؟")) { await api("/api/auth/admin/sessions/revoke-all", { method: "POST" }); await load(); } }
  async function deleteAttempt(id: number) { if (window.confirm("حذف هذا السجل؟")) { await api(`/api/auth/admin/attempts/${id}`, { method: "DELETE" }); await load(); } }
  async function clearAttempts() { if (window.confirm("حذف سجل المحاولات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) { await api("/api/auth/admin/attempts", { method: "DELETE" }); await load(); } }
  async function addVideo(video: CustomVideo) { await api("/api/videos/custom", { method: "POST", body: JSON.stringify(video) }); await loadCustomVideos(); }
  async function removeVideo(id: string) { if (window.confirm("حذف هذا الفيديو من المكتبة المركزية؟")) { await api(`/api/videos/custom/${encodeURIComponent(id)}`, { method: "DELETE" }); await loadCustomVideos(); } }
  async function logout() { await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" }); window.location.href = "/gravity-control-2026"; }

  const activityRows: Activity[] = [
    ...attempts.map((attempt, index) => ({ id: `attempt-${attempt.id ?? `${attempt.createdAt}-${index}`}`, displayName: attempt.displayName, ipAddress: attempt.ipAddress, createdAt: attempt.createdAt, userAgent: attempt.userAgent, kind: "attempt" as const, attempt })),
    ...sessionHistory.map(session => ({ id: `session-${session.id}`, displayName: session.displayName, ipAddress: session.ipAddress, createdAt: session.endedAt ?? session.createdAt, userAgent: session.userAgent, kind: "session" as const, session })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  function activityLabel(activity: Activity) {
    if (activity.kind === "attempt") return reasonLabel(activity.attempt!.reason);
    return sessionStatusLabel(activity.session!).label;
  }
  function activityClass(activity: Activity) {
    if (activity.kind === "attempt") return activity.attempt!.reason === "awaiting_approval" ? "text-amber-200" : activity.attempt!.successful ? "text-[#70e3d8]" : "text-red-200";
    return sessionStatusLabel(activity.session!).className;
  }

  if (adminState === "checking") return <div className="flex min-h-screen items-center justify-center bg-[#080b18] text-[#d1ff68]" dir="rtl"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (adminState === "login") return <main className="flex min-h-screen items-center justify-center bg-[#080b18] px-4 text-white" dir="rtl"><form onSubmit={adminLogin} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0e1326] p-8 shadow-2xl"><div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d1ff68]/20 bg-[#d1ff68]/10 text-[#d1ff68]"><LockKeyhole className="h-6 w-6" /></div><h1 className="font-display text-2xl font-black">دخول لوحة التحكم</h1><p className="mt-2 text-sm text-[#8f93ac]">هذه المساحة للمالك فقط</p></div><label className="block text-sm font-bold">اسم المستخدم<input value={adminUsername} onChange={event => setAdminUsername(event.target.value)} required className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#080b18] px-4 text-left" dir="ltr" /></label><label className="mt-4 block text-sm font-bold">كلمة السر<input value={adminPassword} onChange={event => setAdminPassword(event.target.value)} type="password" required className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#080b18] px-4 text-left" dir="ltr" /></label>{error ? <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}<button disabled={adminSubmitting} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d1ff68] font-black text-[#11170b] disabled:opacity-60">{adminSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}دخول المالك</button><Link href="/" className="mt-5 block text-center text-sm text-[#a8a0ff]">العودة للمكتبة</Link></form></main>;

  return <main className="min-h-screen bg-[#080b18] px-5 py-8 text-[#f7f8ff]" dir="rtl"><div className="mx-auto max-w-6xl"><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-[#a8a0ff] hover:text-white"><ArrowRight className="h-4 w-4" /> العودة للمكتبة</Link><div className="flex items-center gap-3"><div className="rounded-2xl border border-[#d1ff68]/20 bg-[#d1ff68]/10 p-3 text-[#d1ff68]"><ShieldAlert className="h-6 w-6" /></div><div><h1 className="font-display text-3xl font-black">لوحة التحكم</h1><p className="mt-1 text-sm text-[#8f93ac]">الموافقة على الدخول ومراقبة الجلسات</p></div></div></div><div className="flex items-center gap-2"><button onClick={() => setVideoManagerOpen(true)} className="rounded-xl bg-[#d1ff68] px-4 py-2.5 text-sm font-black text-[#11170b]">إدارة الفيديوهات</button><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-[#c4bfff] hover:bg-white/5"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث</button><button onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-4 py-2.5 text-sm font-bold text-red-200 hover:bg-red-400/10"><LogOut className="h-4 w-4" /> خروج</button></div></header>
  {error ? <p className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
  <section className="mb-6 grid gap-4 sm:grid-cols-4"><div className="rounded-2xl border border-[#d1ff68]/20 bg-[#d1ff68]/[0.06] p-5"><p className="text-sm text-[#8f93ac]">طلبات معلقة</p><p className="mt-2 text-3xl font-black text-[#d1ff68]">{requests.length}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-sm text-[#8f93ac]">جلسات نشطة الآن</p><p className="mt-2 text-3xl font-black">{sessions.length}</p></div><div className="rounded-2xl border border-[#48d8ca]/20 bg-[#48d8ca]/[0.06] p-5"><p className="text-sm text-[#8f93ac]">دخول ناجح</p><p className="mt-2 text-3xl font-black text-[#70e3d8]">{summary.successful}</p><p className="mt-1 text-[11px] text-[#737892]">من إجمالي السجل</p></div><div className="rounded-2xl border border-red-300/20 bg-red-400/[0.05] p-5"><p className="text-sm text-[#8f93ac]">محاولات مرفوضة</p><p className="mt-2 text-3xl font-black text-red-200">{summary.failed}</p><p className="mt-1 text-[11px] text-[#737892]">بدون الطلبات المعلقة</p></div></section>
  <section className="mb-6 rounded-2xl border border-[#d1ff68]/20 bg-[#0e1326] p-5"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Clock3 className="h-5 w-5 text-[#d1ff68]" /> طلبات الدخول الحالية</h2><span className="text-xs text-[#737892]">تحديث تلقائي كل 5 ثوانٍ</span></div>{loading && requests.length === 0 ? <div className="p-8 text-center text-[#8f93ac]"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : requests.length === 0 ? <p className="rounded-xl bg-white/[0.03] p-6 text-center text-sm text-[#8f93ac]">لا توجد طلبات معلقة.</p> : <div className="space-y-3">{requests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-[#d1ff68]" /><div><p className="font-bold">{request.displayName}</p><p className="text-xs text-[#8f93ac]">{request.ipAddress} · {new Date(request.createdAt).toLocaleString("ar-EG")} · {browserLabel(request.userAgent)}</p></div></div><div className="flex gap-2"><button onClick={() => void approve(request.id)} className="rounded-lg bg-[#d1ff68] px-4 py-2 text-sm font-black text-[#11170b]">موافقة</button><button onClick={() => setDenyId(request.id)} className="rounded-lg border border-red-300/20 px-4 py-2 text-sm font-bold text-red-200">رفض</button></div>{denyId === request.id ? <div className="basis-full flex gap-2"><input value={denyMessage} onChange={e => setDenyMessage(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#080b18] px-3 py-2 text-sm" placeholder="رسالة الرفض" /><button onClick={() => void deny(request.id)} className="rounded-lg bg-red-400/80 px-4 py-2 text-sm font-bold">إرسال الرفض</button><button onClick={() => setDenyId("")} className="p-2 text-[#8f93ac]"><XCircle className="h-5 w-5" /></button></div> : null}</div>)}</div>}</section>
  <section className="mb-6 rounded-2xl border border-white/10 bg-[#0e1326] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">الجلسات الحالية</h2><p className="mt-1 text-xs text-[#737892]">الجلسات النشطة فقط — الجلسات المنتهية تظهر في السجل أدناه</p></div><button onClick={() => void revokeAll()} className="rounded-lg border border-red-300/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-400/10">إنهاء كل الجلسات</button></div>{loading && sessions.length === 0 ? <p className="text-sm text-[#8f93ac]">جارٍ التحميل...</p> : sessions.length === 0 ? <p className="text-sm text-[#8f93ac]">لا توجد جلسات نشطة.</p> : <div className="space-y-2">{sessions.map(session => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3 text-sm"><div><span className="font-bold">{session.displayName}</span><span className="mr-3 text-xs text-[#8f93ac]">{session.ipAddress} · تنتهي {new Date(session.expiresAt).toLocaleString("ar-EG")} · {browserLabel(session.userAgent)}</span><p className={`mt-1 text-xs ${sessionStatusLabel(session).className}`}>{sessionStatusLabel(session).icon}{sessionStatusLabel(session).label}</p></div><button onClick={() => void revoke(session.id)} className="rounded-lg border border-red-300/20 px-3 py-1.5 text-xs font-bold text-red-200">إنهاء</button></div>)}</div>}</section>
  <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1326]"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="font-bold">محاولات تسجيل الدخول ونشاط الجلسات</h2><p className="mt-1 text-xs text-[#737892]">{summary.total} محاولة دخول · ويظهر هنا أيضًا خروج المستخدم وإنهاء الجلسات</p></div><button onClick={() => void clearAttempts()} disabled={!attempts.length} className="inline-flex items-center gap-2 rounded-lg border border-red-300/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> مسح السجل بالكامل</button></div>{loading && attempts.length === 0 ? <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5" /></div> : attempts.length === 0 ? <p className="p-10 text-center text-sm text-[#8f93ac]">السجل فارغ.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-white/[0.035] text-xs text-[#8f93ac]"><tr><th className="px-5 py-3">الحالة</th><th className="px-5 py-3">الاسم</th><th className="px-5 py-3">عنوان الشبكة</th><th className="px-5 py-3">التاريخ</th><th className="px-5 py-3">المتصفح والجهاز</th><th className="px-5 py-3">إدارة</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{attempts.map((attempt, index) => <tr key={attempt.id ?? `${attempt.createdAt}-${index}`}><td className="px-5 py-4"><span className={attempt.reason === "awaiting_approval" ? "text-amber-200" : attempt.successful ? "text-[#70e3d8]" : "text-red-200"}>{attempt.reason === "awaiting_approval" ? <Clock3 className="ml-1 inline h-4 w-4" /> : attempt.successful ? <CheckCircle2 className="ml-1 inline h-4 w-4" /> : <CircleAlert className="ml-1 inline h-4 w-4" />}{reasonLabel(attempt.reason)}</span></td><td className="px-5 py-4 font-bold text-xs">{attempt.displayName}</td><td className="px-5 py-4 font-mono text-xs text-[#aeb2c9]">{attempt.ipAddress}</td><td className="px-5 py-4 text-xs text-[#aeb2c9]">{new Date(attempt.createdAt).toLocaleString("ar-EG")}</td><td className="px-5 py-4 text-xs text-[#aeb2c9]">{browserLabel(attempt.userAgent)}</td><td className="px-5 py-4">{attempt.id ? <button onClick={() => void deleteAttempt(attempt.id!)} className="inline-flex items-center gap-1 rounded-lg border border-red-300/20 px-2.5 py-1.5 text-xs font-bold text-red-200 hover:bg-red-400/10"><Trash2 className="h-3.5 w-3.5" /> حذف</button> : <span className="text-xs text-[#737892]">—</span>}</td></tr>)}</tbody></table></div>}</section></div>{videoManagerOpen ? <VideoManagerPanel videos={customVideos} nextSortOrder={customVideos.reduce((max, video) => Math.max(max, video.sortOrder), 0) + 1} onSave={(video) => void addVideo(video)} onDelete={(id) => void removeVideo(id)} onClose={() => setVideoManagerOpen(false)} /> : null}</main>;
}
