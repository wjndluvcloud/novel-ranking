// Central registry of ranking sources for the browser UI.
// Each source declares where its archive lives and which charts it publishes.
window.RANKING_SOURCES = Object.freeze([
  Object.freeze({
    id: 'qidian',
    name: 'Qidian',
    label: 'Qidian Ranking',
    homeUrl: 'https://www.qidian.com/',
    dataDir: 'data/qidian',
    charts: Object.freeze([
      Object.freeze({ key: 'monthlyTickets', label: 'Monthly Tickets', chineseLabel: '月票榜' }),
      Object.freeze({ key: 'bestSellers', label: 'Best Sellers', chineseLabel: '畅销榜' }),
      Object.freeze({ key: 'readerRetention', label: 'Reader Retention', chineseLabel: '留存榜' }),
      Object.freeze({ key: 'mostFollowed', label: 'Most Followed', chineseLabel: '追读榜' })
    ])
  }),
  Object.freeze({
    id: 'jinjiang',
    name: 'Jinjiang',
    label: 'Jinjiang Ranking',
    homeUrl: 'https://www.jjwxc.net/',
    dataDir: 'data/jinjiang',
    charts: Object.freeze([
      Object.freeze({ key: 'totalScore', label: 'Total Score', chineseLabel: '总分榜' }),
      Object.freeze({ key: 'monthly', label: 'Monthly', chineseLabel: '月度榜' }),
      Object.freeze({ key: 'quarterly', label: 'Quarterly', chineseLabel: '季度榜' }),
      Object.freeze({ key: 'wordCount', label: 'Word Count', chineseLabel: '字数榜' })
    ])
  }),
  Object.freeze({
    id: 'zongheng',
    name: 'Zongheng',
    label: 'Zongheng Ranking',
    homeUrl: 'https://www.zongheng.com/',
    dataDir: 'data/zongheng',
    charts: Object.freeze([
      Object.freeze({ key: 'clicks', label: 'Most Read', chineseLabel: '点击榜' }),
      Object.freeze({ key: 'monthlyTickets', label: 'Monthly Tickets', chineseLabel: '月票榜' }),
      Object.freeze({ key: 'rewards', label: 'Rewards', chineseLabel: '打赏榜' }),
      Object.freeze({ key: 'newBooks', label: 'New Books', chineseLabel: '新书榜' })
    ])
  }),
  Object.freeze({
    id: 'tomato',
    name: 'Tomato Novel',
    label: 'Tomato Novel Ranking',
    homeUrl: 'https://fanqienovel.com/',
    dataDir: 'data/tomato',
    charts: Object.freeze([
      Object.freeze({ key: 'ancientRomance', label: 'Ancient Romance', chineseLabel: '古风世情' }),
      Object.freeze({ key: 'fantasyRomance', label: 'Fantasy Romance', chineseLabel: '玄幻言情' }),
      Object.freeze({ key: 'scifiApocalypse', label: 'Sci-Fi & Apocalypse', chineseLabel: '科幻末世' }),
      Object.freeze({ key: 'ceoRomance', label: 'CEO Romance', chineseLabel: '豪门总裁' })
    ])
  })
]);
