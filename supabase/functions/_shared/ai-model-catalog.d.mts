type Endpoint={api_url:string;model:string;api_protocol?:string;auth_scheme?:string};
export function modelBase(endpoint:Endpoint):string;
export function modelCatalogRequest(endpoint:Endpoint,key:string,cursor?:string|null):{url:string;headers:Record<string,string>};
export function catalogPage(protocol:unknown,data:unknown):{models:{id:string;label:string}[];next:string|null};
export function sharedModelUrl(endpoint:Endpoint,model:string):string;
