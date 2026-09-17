window.QIDIAN_CATEGORY_LABELS = Object.freeze({
  '都市': Object.freeze({
    label: 'Urban',
    subcategories: Object.freeze({
      '都市生活': 'Urban Life',
      '都市异能': 'Urban Superpowers',
      '异术超能': 'Supernatural Powers',
      '娱乐明星': 'Entertainment'
    })
  }),
  '科幻': Object.freeze({
    label: 'Science Fiction',
    subcategories: Object.freeze({
      '进化变异': 'Evolution & Mutation',
      '时空穿梭': 'Time Travel'
    })
  }),
  '历史': Object.freeze({
    label: 'Historical',
    subcategories: Object.freeze({
      '两晋隋唐': 'Jin, Sui & Tang',
      '两宋元明': 'Song, Yuan & Ming',
      '外国历史': 'World History'
    })
  }),
  '奇幻': Object.freeze({
    label: 'Fantasy',
    subcategories: Object.freeze({ '剑与魔法': 'Sword & Sorcery' })
  }),
  '轻小说': Object.freeze({
    label: 'Light Novel',
    subcategories: Object.freeze({
      '恋爱日常': 'Romance & Daily Life',
      '衍生同人': 'Fan Fiction',
      '原生幻想': 'Original Fantasy'
    })
  }),
  '体育': Object.freeze({
    label: 'Sports',
    subcategories: Object.freeze({
      '篮球运动': 'Basketball',
      '足球运动': 'Football'
    })
  }),
  '武侠': Object.freeze({
    label: 'Wuxia',
    subcategories: Object.freeze({ '传统武侠': 'Traditional Wuxia' })
  }),
  '仙侠': Object.freeze({
    label: 'Xianxia',
    subcategories: Object.freeze({
      '幻想修仙': 'Fantasy Cultivation',
      '修真文明': 'Cultivation'
    })
  }),
  '玄幻': Object.freeze({
    label: 'Xuanhuan Fantasy',
    subcategories: Object.freeze({
      '东方玄幻': 'Eastern Fantasy',
      '高武世界': 'High Martial World',
      '异世大陆': 'Otherworld Fantasy'
    })
  }),
  '悬疑灵异': Object.freeze({
    label: 'Mystery & Supernatural',
    subcategories: Object.freeze({ '惊悚微恐': 'Mild Horror' })
  })
});

window.qidianGenreLabel = (category, subcategory) => {
  const categoryEntry = window.QIDIAN_CATEGORY_LABELS[category];
  const categoryLabel = categoryEntry?.label ?? category ?? 'Uncategorized';
  const subcategoryLabel = categoryEntry?.subcategories[subcategory] ?? subcategory;
  return subcategoryLabel ? `${categoryLabel} · ${subcategoryLabel}` : categoryLabel;
};
