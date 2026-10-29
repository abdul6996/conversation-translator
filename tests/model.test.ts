import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GEMINI_MODEL, getGeminiModel } from '../lib/model';

test('Flash-Lite is the default and model changes need no code edits',()=>{
  const previous=process.env.GEMINI_MODEL;
  try {
    delete process.env.GEMINI_MODEL;
    assert.equal(getGeminiModel(),'gemini-3.5-flash-lite');
    assert.equal(DEFAULT_GEMINI_MODEL,'gemini-3.5-flash-lite');
    process.env.GEMINI_MODEL='  gemini-3.8-flash  ';
    assert.equal(getGeminiModel(),'gemini-3.8-flash');
    process.env.GEMINI_MODEL='  ';
    assert.equal(getGeminiModel(),DEFAULT_GEMINI_MODEL);
  } finally {
    if(previous===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=previous;
  }
});
