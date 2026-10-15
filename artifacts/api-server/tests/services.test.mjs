import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url); const { build } = require('esbuild'); const express = require('express');
test('service CRUD authorization, validation, edits and linked appointment protection', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'service-car-services-')); const env = { ...process.env }; const originalFetch = globalThis.fetch; let server;
  try {
    Object.assign(process.env, { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'fixture', ADMIN_EMAIL: 'admin@example.com' });
    globalThis.fetch = async () => Response.json({ id: 'fixture', email: 'admin@example.com', email_confirmed_at: '2026-01-01' });
    const mock = `
      const rows = new Map();
      export const servicesTable = {id:'id',name:'name'}; export const appointmentsTable = {id:'appointmentId',serviceId:'serviceId'};
      export const db = {
        select: () => ({from: table => ({orderBy: async () => [...rows.values()], where: condition => ({limit: async () => condition.value === 'linked-service' ? [{id:1}] : []})})}),
        insert: () => ({values: data => ({returning: async () => { rows.set(data.id,data); return [data]; }})}),
        update: () => ({set: data => ({where: condition => ({returning: async () => { const row=rows.get(condition.value); if(!row)return [];const next={...row,...data};rows.set(row.id,next);return [next]; }})})}),
        delete: () => ({where: condition => ({returning: async () => { const row=rows.get(condition.value);rows.delete(condition.value);return row?[{id:row.id}]:[]; }})}),
      };
    `;
    const output = path.join(dir, 'router.cjs');
    await build({entryPoints:[path.resolve('src/routes/services.ts')],outfile:output,bundle:true,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'fixtures',setup(build){build.onResolve({filter:/^@workspace\/db$/},()=>({path:'db',namespace:'fixture'}));build.onResolve({filter:/^drizzle-orm$/},()=>({path:'drizzle',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='db'?mock:'export const eq=(column,value)=>({column,value}); export const asc=value=>value;',loader:'js'}));}}]});
    const app=express();app.use(express.json());app.use('/api',require(output).default);server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/admin/services`;
    const call=(suffix='',method='GET',data,authorized=true)=>new Promise((resolve,reject)=>{const req=http.request(base+suffix,{method,headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer fixture'}:{})}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,data:text?JSON.parse(text):null}));});req.on('error',reject);if(data)req.write(JSON.stringify(data));req.end();});
    assert.equal((await call('', 'GET',undefined,false)).status,401);
    const data={name:'Ölwechsel',category:'Wartung',description:'Öl und Filter wechseln',priceLabel:'ab 79 €',durationMinutes:30};
    assert.equal((await call('','POST',{...data,durationMinutes:-1})).status,400);
    const created=await call('','POST',data);assert.equal(created.status,201);const id=created.data.id;
    assert.equal((await call()).data[0].name,'Ölwechsel');
    assert.equal((await call('/'+id,'PUT',{...data,priceLabel:'ab 89 €'})).data.priceLabel,'ab 89 €');
    assert.equal((await call('/linked-service','DELETE')).status,409);
    assert.equal((await call('/'+id,'DELETE')).status,204);
    assert.equal((await call()).data.length,0);
    assert.equal((await call('/missing','PUT',data)).status,404);
  } finally {globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
