import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url); const { build } = require('esbuild');
test('vehicle identities, model-aware image selection, AI fallback and attribution', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'service-car-vehicle-'));
  const originalFetch = globalThis.fetch; const oldKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    const output = path.join(directory,'vehicle.cjs'); await build({entryPoints:[path.resolve('src/lib/vehicle-identity.ts')],outfile:output,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
    const { identifyByName, matchesVehicle, resolveVehicle } = require(output);
    const audi = identifyByName('Audi RS6, 2023'); assert.equal(audi.make,'Audi');assert.equal(audi.model,'RS 6');assert.equal(audi.year,2023);
    assert.equal(identifyByName('BMW 5, 2019').model,'5 Series'); assert.equal(identifyByName('Golf 7.5, 2018').make,'Volkswagen');assert.equal(identifyByName('Golf 7.5, 2018').model,'Golf');
    assert.equal(identifyByName('unbekannt'),null); assert.equal(matchesVehicle('File:Mercedes C Class.jpg',audi),false);assert.equal(matchesVehicle('File:Audi RS6 2023.jpg',audi),true);
    let calls=0;
    const info = {thumburl:'https://upload.wikimedia.org/fixture.png',descriptionurl:'https://commons.wikimedia.org/wiki/File:Audi_RS6.jpg',extmetadata:{Artist:{value:'<a>Fixture Author</a>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}};
    globalThis.fetch=async url=>{calls++;assert.match(String(url),/^https:\/\/commons.wikimedia.org/);return Response.json({query:{pages:{a:{title:'File:Mercedes 2023.jpg',imageinfo:[info]},b:{title:'File:Audi RS6 2023.jpg',imageinfo:[info]}}}});};
    const visual=await resolveVehicle('Audi RS6, 2023');assert.equal(visual.imageUrl,info.thumburl);assert.equal(visual.attribution,'Fixture Author · CC BY-SA 4.0');await resolveVehicle('Audi RS6, 2023');assert.equal(calls,1);
    const unknown=await resolveVehicle('unbekannt');assert.equal(unknown.identity,null);assert.equal(unknown.imageUrl,null);assert.equal(calls,1);
    process.env.OPENAI_API_KEY='fixture-key';
    globalThis.fetch=async (url,options)=>{
      if(String(url).includes('openai.com')) {const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');assert.equal(body.input,'Toyota Corolla, 2020');return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({make:'Toyota',model:'Corolla',year:2020,confidence:0.99})}]}]});}
      return Response.json({query:{pages:{bad:{title:'File:Toyota Camry.jpg',imageinfo:[info]}}}});
    };
    const ai=await resolveVehicle('Toyota Corolla, 2020');assert.equal(ai.identity.model,'Corolla');assert.equal(ai.imageUrl,null);
    globalThis.fetch=async ()=>{throw Error('offline');};const fallback=await resolveVehicle('BMW 3, 2016');assert.equal(fallback.identity.make,'BMW');assert.equal(fallback.imageUrl,null);
  } finally {globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;await rm(directory,{recursive:true,force:true});}
});
