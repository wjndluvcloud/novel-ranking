import assert from 'node:assert/strict';
import test from 'node:test';
import { addVietnameseTranslations, DEFAULT_GEMINI_MODEL } from '../src/translation/gemini.mjs';

function rankings() {
  const entry = { bookId: 'book-1', title: '星辰大道', introduction: '第一行<br>第二行' };
  return {
    first: { entries: [{ ...entry }] },
    second: { entries: [{ ...entry }] }
  };
}

test('translates each unique novel once and applies it to every chart', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      status: 'completed',
      steps: [{
        type: 'model_output',
        content: [{
          type: 'text',
          text: JSON.stringify({ translations: [{ bookId: 'book-1', titleVi: 'Đại Đạo Tinh Thần', introductionVi: 'Dòng một\nDòng hai' }] })
        }]
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const data = rankings();

  await addVietnameseTranslations(data, new Map(), { apiKey: 'test-key', fetchImpl, attempts: 1 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-key');
  const request = JSON.parse(calls[0].options.body);
  assert.equal(request.model, DEFAULT_GEMINI_MODEL);
  assert.match(request.input, /第一行\\n第二行/u);
  assert.equal(data.first.entries[0].titleVi, 'Đại Đạo Tinh Thần');
  assert.equal(data.second.entries[0].introductionVi, 'Dòng một\nDòng hai');
});

test('reuses archived translations without an API call', async () => {
  const data = rankings();
  const archived = new Map([['book-1', { titleVi: 'Tên cũ', introductionVi: 'Giới thiệu cũ' }]]);
  const fetchImpl = async () => { throw new Error('fetch should not be called'); };

  await addVietnameseTranslations(data, archived, { apiKey: 'test-key', fetchImpl });

  assert.equal(data.first.entries[0].titleVi, 'Tên cũ');
  assert.equal(data.first.entries[0].introductionVi, 'Giới thiệu cũ');
});

test('keeps null translations when Gemini fails', async () => {
  const data = rankings();
  const fetchImpl = async () => new Response('quota exceeded', { status: 429 });

  await addVietnameseTranslations(data, new Map(), { apiKey: 'test-key', fetchImpl, attempts: 1 });

  assert.equal(data.first.entries[0].titleVi, null);
  assert.equal(data.first.entries[0].introductionVi, null);
});
