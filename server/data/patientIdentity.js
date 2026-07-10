/**
 * Deterministic unique Chinese names for all n=5000 cohort members.
 * Index bijection: idx = armOffset + (serial - 1)  →  unique (surname, given1, given2).
 */

'use strict';

const SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
  '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆', '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史',
];

const GIVEN_M = [
  '伟', '强', '磊', '洋', '勇', '军', '杰', '涛', '明', '超', '鹏', '辉', '刚', '平', '华', '峰', '斌', '龙', '飞', '鑫',
  '浩', '宇', '轩', '博', '晨', '阳', '俊', '凯', '志', '建', '国', '民', '德', '成', '文', '武', '新', '利', '清', '保',
];

const GIVEN_F = [
  '芳', '娜', '静', '敏', '丽', '娟', '艳', '玲', '燕', '霞', '婷', '雪', '梅', '琳', '慧', '洁', '莉', '红', '兰', '英',
  '华', '秀', '云', '萍', '颖', '璐', '瑶', '茜', '蕾', '薇', '佳', '宁', '怡', '倩', '媛', '菲', '萌', '雅', '欣', '涵',
];

const NAME_SUFFIX = ['', '子', '儿', '之'];

function patientIndexFromId(id) {
  const m = String(id).match(/^(IV|UC)-(\d{4})$/);
  if (!m) return 0;
  const serial = parseInt(m[2], 10);
  const armOffset = m[1] === 'IV' ? 0 : 2500;
  return armOffset + serial - 1;
}

function uniqueNameFromId(id, sex) {
  const idx = patientIndexFromId(id);
  const pool = sex === 'F' ? GIVEN_F : GIVEN_M;
  const sn = SURNAMES.length;
  const gn = pool.length;
  const a = idx % sn;
  const b = Math.floor(idx / sn) % gn;
  const c = Math.floor(idx / (sn * gn)) % gn;
  const suffix = NAME_SUFFIX[Math.floor(idx / (sn * gn * gn)) % NAME_SUFFIX.length];
  let name = SURNAMES[a] + pool[b] + pool[c] + suffix;
  if (pool[b] === pool[c] && !suffix) {
    name = SURNAMES[a] + pool[b] + NAME_SUFFIX[1 + (idx % (NAME_SUFFIX.length - 1))];
  }
  return name;
}

function verifyUniqueNames(patients) {
  const seen = new Set();
  for (const p of patients) {
    const name = uniqueNameFromId(p.id, p.sex);
    if (seen.has(name)) return { ok: false, duplicate: name, id: p.id };
    seen.add(name);
  }
  return { ok: true, count: seen.size };
}

module.exports = {
  patientIndexFromId,
  uniqueNameFromId,
  verifyUniqueNames,
};
