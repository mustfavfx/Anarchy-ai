export interface RalColor {
  code: string;
  name: string;
  nameAr: string;
  hex: string;
  category: 'Greens' | 'Greys' | 'Whites & Off-Whites' | 'Beiges & Browns' | 'Blues' | 'Reds & Oranges' | 'Accents';
}

export const RAL_COLORS: RalColor[] = [
  // Greens
  { code: 'RAL 6024', name: 'Traffic Green', nameAr: 'أخضر المرور القياسي', hex: '#308446', category: 'Greens' },
  { code: 'RAL 6005', name: 'Moss Green', nameAr: 'أخضر طحلبي داكن', hex: '#2F4538', category: 'Greens' },
  { code: 'RAL 6021', name: 'Pale Green', nameAr: 'أخضر هادئ (مريمية)', hex: '#8DA48F', category: 'Greens' },
  { code: 'RAL 6018', name: 'Yellow Green', nameAr: 'أخضر عشبي عالي الحيوية', hex: '#57A639', category: 'Greens' },
  { code: 'RAL 6003', name: 'Olive Green', nameAr: 'أخضر زيتوني معماري', hex: '#4F523E', category: 'Greens' },

  // Greys
  { code: 'RAL 7016', name: 'Anthracite Grey', nameAr: 'رمادي أنثراسايت عصري', hex: '#383E42', category: 'Greys' },
  { code: 'RAL 7021', name: 'Black Grey', nameAr: 'رمادي أسود فاحم', hex: '#2F3234', category: 'Greys' },
  { code: 'RAL 7035', name: 'Light Grey', nameAr: 'رمادي فاتح للمظهر الخرساني', hex: '#CBD2D0', category: 'Greys' },
  { code: 'RAL 7040', name: 'Window Grey', nameAr: 'رمادي الإطارات والنوافذ', hex: '#989EA1', category: 'Greys' },
  { code: 'RAL 7044', name: 'Silk Grey', nameAr: 'رمادي حريري دافئ', hex: '#BDBDBA', category: 'Greys' },

  // Whites & Off-Whites
  { code: 'RAL 9010', name: 'Pure White', nameAr: 'أبيض ناصع نقي', hex: '#F7F9EF', category: 'Whites & Off-Whites' },
  { code: 'RAL 9016', name: 'Traffic White', nameAr: 'أبيض مشرق للمعماريين', hex: '#F6F6F6', category: 'Whites & Off-Whites' },
  { code: 'RAL 9001', name: 'Cream', nameAr: 'أبيض كريمي عاجي', hex: '#EFEBDC', category: 'Whites & Off-Whites' },
  { code: 'RAL 9003', name: 'Signal White', nameAr: 'أبيض حائطي قياسي', hex: '#F4F4F4', category: 'Whites & Off-Whites' },

  // Beiges & Browns
  { code: 'RAL 1013', name: 'Oyster White', nameAr: 'أبيض لؤلؤي دافئ', hex: '#E3D9C6', category: 'Beiges & Browns' },
  { code: 'RAL 1015', name: 'Light Ivory', nameAr: 'عاجي فاتح صحراوي', hex: '#E6D2B5', category: 'Beiges & Browns' },
  { code: 'RAL 8001', name: 'Ochre Brown', nameAr: 'بني مغرة طبيعي', hex: '#9B5B25', category: 'Beiges & Browns' },
  { code: 'RAL 8017', name: 'Chocolate Brown', nameAr: 'بني شوكولاتة داكن', hex: '#442B23', category: 'Beiges & Browns' },

  // Blues
  { code: 'RAL 5011', name: 'Steel Blue', nameAr: 'أزرق فولاذي داكن', hex: '#1A2B3C', category: 'Blues' },
  { code: 'RAL 5008', name: 'Grey Blue', nameAr: 'أزرق رمادي محيطي', hex: '#2B353E', category: 'Blues' },
  { code: 'RAL 5024', name: 'Pastel Blue', nameAr: 'أزرق باستيل ناعم', hex: '#6A93AC', category: 'Blues' },

  // Reds & Oranges
  { code: 'RAL 3000', name: 'Flame Red', nameAr: 'أحمر ناري ناصع', hex: '#AF2B1E', category: 'Reds & Oranges' },
  { code: 'RAL 3012', name: 'Beige Red', nameAr: 'أحمر بيج قرميدي', hex: '#C68875', category: 'Reds & Oranges' },
  { code: 'RAL 2004', name: 'Pure Orange', nameAr: 'برتقالي نقي عصري', hex: '#E25303', category: 'Reds & Oranges' },

  // Accents
  { code: 'RAL 1023', name: 'Traffic Yellow', nameAr: 'أصفر إشارات عصري', hex: '#F7B500', category: 'Accents' },
  { code: 'RAL 4006', name: 'Traffic Purple', nameAr: 'بنفسجي معماري مبهر', hex: '#922B78', category: 'Accents' },
  { code: 'RAL 9005', name: 'Jet Black', nameAr: 'أسود معتم نفاث', hex: '#0A0A0A', category: 'Accents' },
];
