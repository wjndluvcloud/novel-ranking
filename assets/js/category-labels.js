window.QIDIAN_CATEGORY_LABELS = Object.freeze({
  '都市': Object.freeze({
    label: 'Đô thị',
    subcategories: Object.freeze({
      '都市生活': 'Cuộc sống đô thị',
      '都市异能': 'Siêu năng lực đô thị',
      '异术超能': 'Năng lực siêu nhiên',
      '娱乐明星': 'Giải trí'
    })
  }),
  '科幻': Object.freeze({
    label: 'Khoa học viễn tưởng',
    subcategories: Object.freeze({
      '进化变异': 'Tiến hóa & biến dị',
      '时空穿梭': 'Du hành thời gian'
    })
  }),
  '历史': Object.freeze({
    label: 'Lịch sử',
    subcategories: Object.freeze({
      '两晋隋唐': 'Nhà Tấn, Tùy & Đường',
      '两宋元明': 'Nhà Tống, Nguyên & Minh',
      '外国历史': 'Lịch sử thế giới'
    })
  }),
  '奇幻': Object.freeze({
    label: 'Kỳ ảo',
    subcategories: Object.freeze({ '剑与魔法': 'Kiếm và ma pháp' })
  }),
  '轻小说': Object.freeze({
    label: 'Tiểu thuyết nhẹ',
    subcategories: Object.freeze({
      '恋爱日常': 'Tình cảm & đời thường',
      '衍生同人': 'Đồng nhân',
      '原生幻想': 'Kỳ ảo nguyên bản'
    })
  }),
  '体育': Object.freeze({
    label: 'Thể thao',
    subcategories: Object.freeze({
      '篮球运动': 'Bóng rổ',
      '足球运动': 'Bóng đá'
    })
  }),
  '武侠': Object.freeze({
    label: 'Võ hiệp',
    subcategories: Object.freeze({ '传统武侠': 'Võ hiệp truyền thống' })
  }),
  '仙侠': Object.freeze({
    label: 'Tiên hiệp',
    subcategories: Object.freeze({
      '幻想修仙': 'Tu tiên huyền huyễn',
      '修真文明': 'Tu chân'
    })
  }),
  '玄幻': Object.freeze({
    label: 'Huyền huyễn',
    subcategories: Object.freeze({
      '东方玄幻': 'Huyền huyễn phương Đông',
      '高武世界': 'Thế giới võ đạo cấp cao',
      '异世大陆': 'Huyền huyễn dị giới'
    })
  }),
  '悬疑灵异': Object.freeze({
    label: 'Trinh thám & siêu nhiên',
    subcategories: Object.freeze({ '惊悚微恐': 'Kinh dị nhẹ' })
  })
});

window.SOURCE_CATEGORY_LABELS = Object.freeze({
  qidian: window.QIDIAN_CATEGORY_LABELS,
  jinjiang: Object.freeze({
    '近代现代': Object.freeze({ label: 'Hiện đại', subcategories: Object.freeze({ '爱情': 'Tình cảm', '剧情': 'Chính kịch', '悬疑': 'Trinh thám', '传奇': 'Truyền kỳ', '东方衍生': 'Phái sinh phương Đông', '西方衍生': 'Phái sinh phương Tây' }) }),
    '幻想未来': Object.freeze({ label: 'Kỳ ảo tương lai', subcategories: Object.freeze({ '爱情': 'Tình cảm', '游戏': 'Trò chơi', '传奇': 'Truyền kỳ', '剧情': 'Chính kịch', '轻小说': 'Tiểu thuyết nhẹ' }) }),
    '架空历史': Object.freeze({ label: 'Lịch sử hư cấu', subcategories: Object.freeze({ '奇幻': 'Kỳ ảo', '仙侠': 'Tiên hiệp', '爱情': 'Tình cảm', '剧情': 'Chính kịch', '东方衍生': 'Phái sinh phương Đông', '西方衍生': 'Phái sinh phương Tây', '其他衍生': 'Phái sinh khác', '悬疑': 'Trinh thám', '古典衍生': 'Phái sinh cổ điển' }) }),
    '古色古香': Object.freeze({ label: 'Cổ phong', subcategories: Object.freeze({ '爱情': 'Tình cảm', '剧情': 'Chính kịch' }) })
  }),
  zongheng: Object.freeze({
    '玄幻奇幻': Object.freeze({ label: 'Huyền huyễn kỳ ảo', subcategories: Object.freeze({}) }),
    '武侠仙侠': Object.freeze({ label: 'Võ hiệp tiên hiệp', subcategories: Object.freeze({}) }),
    '都市': Object.freeze({ label: 'Đô thị', subcategories: Object.freeze({}) }),
    '历史': Object.freeze({ label: 'Lịch sử', subcategories: Object.freeze({}) }),
    '科幻': Object.freeze({ label: 'Khoa học viễn tưởng', subcategories: Object.freeze({}) }),
    '奇闻异事': Object.freeze({ label: 'Kỳ văn dị sự', subcategories: Object.freeze({}) }),
    '游戏': Object.freeze({ label: 'Trò chơi', subcategories: Object.freeze({}) }),
    'N次元': Object.freeze({ label: 'Đa chiều', subcategories: Object.freeze({}) }),
    '现实题材': Object.freeze({ label: 'Đề tài hiện thực', subcategories: Object.freeze({}) }),
    '体育': Object.freeze({ label: 'Thể thao', subcategories: Object.freeze({}) }),
    '军事': Object.freeze({ label: 'Quân sự', subcategories: Object.freeze({}) }),
    '现代言情': Object.freeze({ label: 'Ngôn tình hiện đại', subcategories: Object.freeze({}) })
  }),
  faloo: Object.freeze({
    '东方玄幻': Object.freeze({ label: 'Huyền huyễn phương Đông', subcategories: Object.freeze({}) }),
    '传统武侠': Object.freeze({ label: 'Võ hiệp truyền thống', subcategories: Object.freeze({}) }),
    '动漫同人': Object.freeze({ label: 'Đồng nhân anime', subcategories: Object.freeze({}) }),
    '小说同人': Object.freeze({ label: 'Đồng nhân tiểu thuyết', subcategories: Object.freeze({}) }),
    '幻想精灵': Object.freeze({ label: 'Kỳ ảo tinh linh', subcategories: Object.freeze({}) }),
    '异世大陆': Object.freeze({ label: 'Đại lục dị giới', subcategories: Object.freeze({}) }),
    '影视同人': Object.freeze({ label: 'Đồng nhân điện ảnh & truyền hình', subcategories: Object.freeze({}) }),
    '星际科幻': Object.freeze({ label: 'Khoa học viễn tưởng liên sao', subcategories: Object.freeze({}) }),
    '架空历史': Object.freeze({ label: 'Lịch sử hư cấu', subcategories: Object.freeze({}) }),
    '武侠修真': Object.freeze({ label: 'Võ hiệp tu chân', subcategories: Object.freeze({}) }),
    '虚拟网游': Object.freeze({ label: 'Trò chơi trực tuyến thực tế ảo', subcategories: Object.freeze({}) }),
    '轻幻想': Object.freeze({ label: 'Kỳ ảo nhẹ', subcategories: Object.freeze({}) }),
    '都市异能': Object.freeze({ label: 'Dị năng đô thị', subcategories: Object.freeze({}) }),
    '都市生活': Object.freeze({ label: 'Cuộc sống đô thị', subcategories: Object.freeze({}) })
  }),
  tomato: Object.freeze({
    '古风世情': Object.freeze({ label: 'Cổ phong thế tình', subcategories: Object.freeze({}) }),
    '玄幻言情': Object.freeze({ label: 'Huyền huyễn ngôn tình', subcategories: Object.freeze({}) }),
    '科幻末世': Object.freeze({ label: 'Khoa học viễn tưởng hậu tận thế', subcategories: Object.freeze({}) }),
    '豪门总裁': Object.freeze({ label: 'Tài phiệt tổng tài', subcategories: Object.freeze({}) })
  })
});

window.genreLabelForSource = (sourceId, category, subcategory) => {
  const categoryEntry = window.SOURCE_CATEGORY_LABELS[sourceId]?.[category];
  const categoryLabel = categoryEntry?.label ?? category ?? 'Chưa phân loại';
  const subcategoryLabel = categoryEntry?.subcategories[subcategory] ?? subcategory;
  return subcategoryLabel ? `${categoryLabel} · ${subcategoryLabel}` : categoryLabel;
};
