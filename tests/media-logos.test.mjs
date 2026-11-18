import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import catalog from '../public/assets/catalog.json' with { type: 'json' };
import logos from '../src/logos.json' with { type: 'json' };

test('每个在用媒体来源都有可随站点发布的标识', () => {
  for (const source of catalog.sources.filter(s => s.visibility === 'active' && s.sourceType === 'media')) {
    assert.ok(logos[source.id]?.startsWith('/assets/'), source.id);
    const file = new URL('../public' + logos[source.id], import.meta.url);
    assert.ok(statSync(file).isFile() && statSync(file).size > 0, source.id);
  }
});
