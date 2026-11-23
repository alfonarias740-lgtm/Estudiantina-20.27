import {createHmac,randomBytes,scryptSync,timingSafeEqual,randomUUID} from "node:crypto";
const {SUPABASE_URL:U,SUPABASE_SERVICE_KEY:K,AUTH_SECRET:SEC,SETUP_KEY}=process.env;
const sb=async(p,o={})=>{const r=await fetch(U+"/rest/v1/"+p,{...o,headers:{apikey:K,authorization:"Bearer "+K,"content-type":"application/json",...o.headers}});if(!r.ok)throw new Error(await r.text());const t=await r.text();return t?JSON.parse(t):null};
const hash=p=>{const s=randomBytes(16).toString("hex");return s+":"+scryptSync(String(p),s,32).toString("hex")};
const check=(p,h)=>{if(!h||!p)return false;const[s,x]=h.split(":");return timingSafeEqual(scryptSync(String(p),s,32),Buffer.from(x,"hex"))};
const mac=b=>createHmac("sha256",SEC).update(b).digest("base64url");
const sign=o=>{const b=Buffer.from(JSON.stringify(o)).toString("base64url");return b+"."+mac(b)};
const verify=t=>{try{const[b,s]=t.split(".");if(s!==mac(b))return null;const o=JSON.parse(Buffer.from(b,"base64url"));return o.exp>Date.now()?o:null}catch{return null}};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const getCfg=async()=>(await sb("config?id=eq.1"))[0]?.data||null;
const setCfg=d=>sb("config",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({id:1,data:d})});
const put=(id,kind,data,by)=>sb("items",{method:"POST",body:JSON.stringify({id,kind,data,by,ts:Date.now()})});
const build=(b,o)=>({school:b.school||"",start:b.start||"",end:b.end||"",
 sextoHash:b.sextoPassword?hash(b.sextoPassword):o.sextoHash,
 courses:(b.courses||[]).map((c,i)=>{const p=o.courses?.[i];return{id:p?.id||randomUUID(),name:c.name,color:c.color||"#888",members:c.members||"",hash:c.password?hash(c.password):p?.hash}}),
 coordinators:(b.coordinators||[]).slice(0,10).map((c,i)=>({name:c.name,hash:c.password?hash(c.password):o.coordinators?.[i]?.hash}))});
export default async req=>{
 const route=new URL(req.url).pathname.replace(/^\/api\//,"");
 const me=verify((req.headers.get("authorization")||"").slice(7));
 const b=req.method==="POST"?await req.json().catch(()=>({})):{};
 try{
  const cfg=await getCfg();
  if(route==="setup"){
   if(cfg)return J({error:"Ya está configurado"},403);
   if(SETUP_KEY&&b.setupKey!==SETUP_KEY)return J({error:"Clave de instalación incorrecta"},403);
   await setCfg(build(b,{}));return J({ok:1})}
  if(!cfg)return J({cfg:null});
  const cn=id=>cfg.courses.find(c=>c.id===id)?.name||"?";
  if(route==="login"){
   let ok=false,name,id=b.id;
   if(b.role==="course"){const c=cfg.courses.find(x=>x.id===b.id);ok=!!c&&check(b.password,c.hash);name=c?.name}
   else if(b.role==="sexto"){ok=check(b.password,cfg.sextoHash);name="Sexto año";id="sexto"}
   else if(b.role==="coord"){const c=cfg.coordinators[+b.id];ok=!!c&&check(b.password,c.hash);name=c?.name;id=String(b.id)}
   if(!ok){await new Promise(r=>setTimeout(r,900));return J({error:"Contraseña incorrecta"},401)}
   const role=b.role;return J({role,id,name,token:sign({role,id,name,exp:Date.now()+12*36e5})})}
  const isC=me?.role==="coord";
  if(route==="state"){
   const d=new URL(req.url).searchParams.get("d")||"";
   const items=await sb("items?select=*&order=ts.asc");
   const out={cfg:{school:cfg.school,start:cfg.start,end:cfg.end,courses:cfg.courses.map(({hash,...c})=>c),coordinators:cfg.coordinators.map(c=>({name:c.name}))},pts:[],acts:[],news:[],cal:[],polls:[],log:[]};
   const votes=items.filter(i=>i.kind==="vote");
   for(const i of items){
    if(i.kind==="vote")continue;
    if(i.kind==="log"&&!isC)continue;
    const o={id:i.id,ts:i.ts,by:i.by,...i.data};
    if(i.kind==="news"&&o.to?.length&&!isC&&!(me?.role==="course"&&o.to.includes(me.id))&&me?.role!=="sexto")continue;
    if(i.kind==="polls"){
     const vs=votes.filter(v=>v.data.poll===i.id),closed=Date.now()>new Date(o.to);
     o.mine=!!me&&vs.some(v=>v.id===`vote_${i.id}_${me.role}${me.id}_${d}`);
     if(isC||closed)o.counts=o.opts.map((_,k)=>vs.filter(v=>v.data.opt===k).length)}
    out[i.kind]?.push(o)}
   return J(out)}
  if(!me)return J({error:"Iniciá sesión"},401);
  if(route==="vote"){
   const p=(await sb("items?id=eq."+encodeURIComponent(b.poll)+"&kind=eq.polls"))[0];
   if(!p)return J({error:"Encuesta inexistente"},404);
   const n=Date.now();if(n<new Date(p.data.from)||n>new Date(p.data.to))return J({error:"Encuesta cerrada"},400);
   if(!(b.opt>=0&&b.opt<p.data.opts.length))return J({error:"Opción inválida"},400);
   try{await put(`vote_${b.poll}_${me.role}${me.id}_${String(b.device).slice(0,40)}`,"vote",{poll:b.poll,opt:b.opt},null)}catch{return J({error:"Ya votaste"},409)}
   return J({ok:1})}
  if(!isC)return J({error:"Sin permisos de coordinador"},403);
  const log=t=>put(randomUUID(),"log",{text:t},me.name);
  if(route==="add"){
   const k=b.kind,d=b.data||{};
   if(!["pts","acts","news","cal","polls"].includes(k)||JSON.stringify(d).length>6000)return J({error:"Datos inválidos"},400);
   let t;
   if(k==="pts"){d.delta=+d.delta;if(!d.delta||!d.reason||!cfg.courses.some(c=>c.id===d.course))return J({error:"Puntos, curso y motivo obligatorios"},400);t=`${d.delta>0?"Se agregaron":"Se descontaron"} ${Math.abs(d.delta)} puntos a ${cn(d.course)}: ${d.reason}`}
   if(k==="acts")t="Se publicó actividad: "+d.name;
   if(k==="news")t="Se publicó noticia: "+d.title;
   if(k==="cal")t="Evento de calendario: "+d.title;
   if(k==="polls")t="Se creó encuesta: "+d.q;
   await put(randomUUID(),k,d,me.name);await log(t);return J({ok:1})}
  if(route==="delete"){
   const it=(await sb("items?id=eq."+encodeURIComponent(b.id)))[0];
   if(!it||["log","vote"].includes(it.kind))return J({error:"No se puede eliminar"},400);
   await sb("items?id=eq."+encodeURIComponent(b.id),{method:"DELETE"});
   if(it.kind==="polls")await sb("items?id=like."+encodeURIComponent("vote_"+b.id+"_")+"*",{method:"DELETE"});
   await log(`Se eliminó (${it.kind}): ${it.data.name||it.data.title||it.data.q||it.data.reason||""}`);return J({ok:1})}
  if(route==="config"){await setCfg(build(b,cfg));await log("Se modificó la configuración");return J({ok:1})}
  return J({error:"Ruta inexistente"},404);
 }catch(e){return J({error:"Error del servidor"},500)}
};
export const config={path:"/api/*"};
