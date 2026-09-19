import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTomato, parseTomatoBookPage } from '../src/sources/tomato/index.mjs';
import { parseZongheng } from '../src/sources/zongheng/index.mjs';

test('Tomato parser skips duplicate virtual-list rows and retains rank order', () => {
  const row = (id, title) => `<article class="book-item-text"><div class="title"><a href="/page/${id}">${title}</a></div><div class="author"><a>Author ${id}</a></div></article>`;
  const html = [row('1', 'One'), row('2', 'Two'), row('1', 'One again'), row('3', 'Three')].join('');
  const entries = parseTomato(html, { chineseLabel: 'Test', metricLabel: 'Readers' });

  assert.deepEqual(entries.map(entry => [entry.rank, entry.bookId, entry.title]), [
    [1, 'tomato-1', 'One'],
    [2, 'tomato-2', 'Two'],
    [3, 'tomato-3', 'Three']
  ]);
});

test('Tomato book-page parser returns canonical Unicode metadata', () => {
  const metadata = parseTomatoBookPage('<div class="info-name"><h1>惹金枝</h1></div><span class="author-name-text">空留</span>');
  assert.deepEqual(metadata, { title: '惹金枝', author: '空留' });
});

test('Zongheng parser reads redesigned Nuxt ranking rows', () => {
  const html = `<section class="rank-modules-works--main-item">
    <a href="//www.zongheng.com/detail/1336976"><img src="https://covers.example/1.jpg"></a>
    <div class="rank-modules-works--main-item-content">
      <a class="rank-modules-works--main-item-title" href="//www.zongheng.com/detail/1336976">无敌天命</a>
      <div class="rank-modules-works--main-item-author"><a>青鸾峰上</a></div>
    </div>
  </section>`;
  const [entry] = parseZongheng(html, { key: 'clicks', chineseLabel: '点击榜', metricLabel: '点击' });

  assert.deepEqual(entry, {
    rank: 1,
    bookId: 'zongheng-1336976',
    title: '无敌天命',
    author: '青鸾峰上',
    category: '点击榜',
    subcategory: null,
    metric: null,
    metricLabel: '点击',
    metricProtected: true,
    bookUrl: 'https://www.zongheng.com/detail/1336976',
    coverUrl: 'https://covers.example/1.jpg'
  });
});
