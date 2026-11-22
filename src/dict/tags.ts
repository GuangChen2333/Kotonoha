/** JMdict 词性标签的中文名;不认识的标签原样显示。 */
const POS: Record<string, string> = {
  n: '名词', 'n-adv': '副词性名词', 'n-suf': '名词性接尾辞', 'n-pref': '名词性接头辞', 'n-t': '时间名词', pn: '代词', ctr: '量词', num: '数词',
  'adj-i': 'い形容词', 'adj-ix': 'い形容词', 'adj-na': 'な形容词', 'adj-no': 'の形容词', 'adj-pn': '连体词', 'adj-t': 'たる形容词', 'adj-f': '名词性修饰语',
  adv: '副词', 'adv-to': '副词(と)', conj: '接续词', int: '感叹词', prt: '助词', aux: '助动词', 'aux-v': '助动词', 'aux-adj': '助形容词', cop: '断定助动词',
  pref: '接头辞', suf: '接尾辞', exp: '惯用语', unc: '未分类', v1: '一段动词', 'v1-s': '一段动词', vs: '可接する的名词', 'vs-i': 'する动词', 'vs-s': 'する动词',
  vk: 'カ变动词', vz: 'ずる动词', vi: '自动词', vt: '他动词', vr: 'り动词', vn: 'ぬ动词',
  v5u: '五段动词', 'v5u-s': '五段动词', v5k: '五段动词', 'v5k-s': '五段动词(行く)', v5g: '五段动词', v5s: '五段动词', v5t: '五段动词', v5n: '五段动词',
  v5b: '五段动词', v5m: '五段动词', v5r: '五段动词', 'v5r-i': '五段动词(不规则)', v5aru: '五段动词(ある)',
}

export const posLabel = (code: string): string => POS[code] ?? code
