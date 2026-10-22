-- GLM free API keys are scoped to the chosen official platform.
-- Preserve existing keys' legacy Z.AI route until the user selects BigModel.
alter table public.mail_preferences
 add column if not exists ai_glm_platform text not null default 'zai'
 check (ai_glm_platform in ('zai','bigmodel'));
