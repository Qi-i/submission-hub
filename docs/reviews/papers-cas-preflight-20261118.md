# Submission Hub `papers` 服务端 CAS 前置核查 · 2026-11-18

**结论（2026-11-18 生产库只读元数据已核验）：现有 `papers.updated_at` 不足以作为完全可靠的 CAS 版本号。已直接查询真实 Supabase 的系统目录；没有执行任何 DDL、DML 或读取稿件/邮箱/附件内容。**

核验结果：`public.papers` 表存在，RLS 已开启，存在 SELECT、INSERT、UPDATE、DELETE 四项 RLS 策略；四项均包含 `auth.uid()` 身份约束，UPDATE 策略有显式 `WITH CHECK`。但该表的**非内部 UPDATE 触发器为 0**，`row_version` 列不存在，仅有 `updated_at TIMESTAMPTZ`。这意味着任何遗漏了客户端更新时间戳的写入路径都可能使基于时间戳的条件更新漏判冲突。建议迁移必须先经审核并备份，之后才能作为生产有效保护。

仓库 `supabase/001_init.sql` 声明了 `papers.updated_at` 和按 `auth.uid() = user_id` 限定的 SELECT/INSERT/UPDATE/DELETE RLS 策略，但现有 `supabase/*.sql` 中未发现对 `papers` 自动推进 `updated_at` 的触发器。稿件表单旧客户端及未知的数据库写入路径未经过生产全量验证。

## 只读预检 SQL（在目标 Supabase SQL Editor 执行前核对项目）

以下查询只读取数据库元数据，不读取稿件标题、邮件、邮箱、文件或令牌。

```sql
-- 1. papers 的时间戳和版本列是否存在
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='papers'
  AND column_name IN ('updated_at','row_version')
ORDER BY column_name;

-- 2. 是否有对 papers 触发的更新保护（显示函数名、定义）
SELECT t.tgname, pg_get_triggerdef(t.oid) AS trigger_ddl,
       p.proname AS function_name, p.prosecdef AS security_definer
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public' AND c.relname='papers'
  AND NOT t.tgisinternal;

-- 3. RLS 是否开启、策略是否覆盖用户自己的行
SELECT c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='papers';
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='papers'
ORDER BY policyname;
```

## 建议迁移

`supabase/044_papers_server_revision.sql` 为**待审查、未执行**的迁移草案：

- 增加 `row_version BIGINT`（现有行默认 1）；
- 任何 UPDATE 均由服务端递增 `row_version` 且更新 `updated_at`，避免旧客户端或其他路径忘记更新时间；
- 下一版客户端必须在稿件更新和删除请求的 WHERE 中同时按当前 `row_version` 条件匹配，并按零行返回拒绝覆盖；
- 在正式应用迁移前先检查数据库已有触发器，避免重复写入逻辑或不同策略相互覆盖；
- 禁止只凭本地模拟测试宣称真实 PostgreSQL 并发安全。

## 验收边界

| 检查项 | 状态 |
| --- | --- |
| 仓库 schema 中存在 `papers.updated_at` | PASS（`supabase/001_init.sql`） |
| 现有迁移中明确保证所有 `papers` UPDATE 改写时间戳 | FAIL（仓库未发现） |
| 生产数据库 RLS 实际状态 | PASS（已启用，4 条策略均按 `auth.uid()` 约束；UPDATE 有显式 WITH CHECK） |
| 生产数据库 UPDATE 版本触发器 | FAIL（已只读确认：0 个） |
| 生产数据库 `row_version` 列 | FAIL（已只读确认：不存在） |
| 服务端 `row_version` 迁移已应用 | NOT RUN |
| 双设备/旧客户端交错 UPDATE 与 DELETE 严格 CAS | NOT RUN |

**禁止在没有可恢复备份和实际客户端兼容性验证的情况下执行迁移。** 此 PR 不包含云端部署动作，也不能把未执行的 SQL 当成实际保护。
