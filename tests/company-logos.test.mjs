import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import data from '../public/assets/catalog.json' with { type: 'json' };
import logos from '../src/logos.json' with { type: 'json' };
import { trackedCompanies } from '../src/domain/company-research.js';

test('every tracked company official source has a local nonempty logo asset', async()=>{
  for(const company of trackedCompanies(data)){
    const sources=data.sources.filter(s=>s.sourceType==='company'&&s.companyIds?.includes(company.id));
    assert.ok(sources.length,company.id);
    for(const source of sources){
      assert.ok(logos[source.id]?.startsWith('/assets/'),source.id);
      const file=new URL('../public'+logos[source.id],import.meta.url);
      assert.ok((await stat(file)).size>100,source.id);
    }
  }
  assert.equal(logos['athub-news'],logos['athub-disclosures']);
});
