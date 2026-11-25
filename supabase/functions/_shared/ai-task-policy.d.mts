export type AiTask='mail_translation'|'mail_analysis'|'ledger_text'|'ledger_vision';
export type AiTaskPolicy={routes:string[];allowPaid:boolean};
export const AI_TASKS:AiTask[];
export function taskPolicy(pref:Record<string,any>,task:AiTask):{routes:string[];fallback:boolean;allowPaid:boolean;inherit:boolean};
export function endpointEligible(endpoint:Record<string,any>|null|undefined,task:AiTask,policy:{fallback:boolean;allowPaid:boolean},options?:{consent?:boolean}):boolean;
