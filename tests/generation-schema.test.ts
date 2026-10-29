import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {generationSchema} from '../lib/generation-schema';
import {notesSchema,resultSchema} from '../lib/types';

test('generation schema preserves shape without nested decoder bounds',()=>{
  const schema=generationSchema(z.toJSONSchema(notesSchema)) as any;
  assert.equal(schema.type,'object');assert.ok(schema.required.includes('actions'));
  assert.equal(schema.properties.actions.items.properties.segmentIds.items.type,'string');
  assert.equal(schema.properties.actions.maxItems,undefined);
  assert.equal(schema.properties.actions.items.properties.segmentIds.minItems,undefined);
  assert.equal(schema.properties.summary.maxLength,undefined);
  assert.equal(schema.additionalProperties,false);
});
test('removing decoding bounds does not remove server validation or enums',()=>{
  const schema=generationSchema(z.toJSONSchema(resultSchema)) as any;
  assert.deepEqual(schema.properties.status.enum,['transcribed','no_speech','unclear']);
  assert.equal(notesSchema.safeParse({summary:'x'.repeat(12001),keyPoints:[],decisions:[],actions:[],openQuestions:[]}).success,false);
  assert.equal(notesSchema.safeParse({summary:'test',keyPoints:[{text:'unsupported',segmentIds:[]}],decisions:[],actions:[],openQuestions:[]}).success,false);
});
