import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ai=readFileSync(new URL('../components/AiPanel.tsx',import.meta.url),'utf8');
const drop=readFileSync(new URL('../components/DropZone.tsx',import.meta.url),'utf8');
test('document index requires explicit consent',()=>{
 assert.match(ai,/const buildDocIndex = async \(\) => \{\s*if \(!docAiConsent \|\| ragBuilding\) return;/);
 assert.match(ai,/disabled=\{ragBuilding \|\| !docAiConsent\}/);
});
test('document question cannot transmit excerpts without consent',()=>{
 assert.match(ai,/if \(!docAiConsent \|\| !ragIndex \|\| !ragQuestion\.trim\(\) \|\| ragAsking\) return;/);
 assert.match(ai,/disabled=\{!docAiConsent \|\| ragAsking/);
});
test('new source revokes AI consent and discards stale index',()=>{
 assert.match(ai,/docAiGeneration\.current \+= 1/);
 assert.match(ai,/\}, \[state\.sources\]\)/);
 assert.match(ai,/setDocAiConsent\(false\)/);
 assert.match(ai,/if \(generation !== docAiGeneration\.current\) return;/);
});
test('disclosure distinguishes local PDF editing from remote AI text processing',()=>{
 assert.match(ai,/Indexing extracts text from this PDF and sends the text in chunks/);
 assert.match(ai,/Asking a question sends relevant excerpts/);
 assert.doesNotMatch(drop,/Nothing is uploaded, ever/);
 assert.match(drop,/Optional AI tools can send text/);
});
