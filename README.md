# Gravity Video Library

مكتبة فيديوهات تعليمية عربية مبنية بـ React وExpress وDrizzle/MySQL.

## التشغيل

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

المتغيرات المطلوبة في الإنتاج:

- `DATABASE_URL`
- `JWT_SECRET` بطول 32 حرفًا أو أكثر
- `GRAVITY_AUTH_USERNAME` و`GRAVITY_AUTH_PASSWORD` لدخول الطلاب
- `GRAVITY_ADMIN_USERNAME` و`GRAVITY_ADMIN_PASSWORD` للوحة الإدارة

لوحة الإدارة موجودة على `/gravity-control-2026`. إضافة الفيديوهات وحذفها يتمان من لوحة الإدارة ويحفظان مركزيًا في قاعدة البيانات، بينما تقدم المشاهدة والواجبات يظلان محليين لكل جهاز حاليًا.

## الفحوصات

```bash
pnpm check
pnpm test
pnpm build
```

لا ترفع ملف `.env` أو أي قيمة سرية إلى GitHub.
