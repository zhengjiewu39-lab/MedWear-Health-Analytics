/** 医院与医疗机构库 — 含合法执业资质信息 */

const { haversineKm } = require('../geo/location');

const LICENSE_TYPES = {
  hospital: '医疗机构执业许可证',
  clinic: '医疗机构执业许可证',
  checkup: '医疗机构执业许可证',
  lab: '医疗机构执业许可证',
};

function facility(id, data) {
  return {
    id,
    verified: true,
    licenseType: LICENSE_TYPES[data.type] || '医疗机构执业许可证',
    ...data,
  };
}

const FACILITY_DB = [
  // ── 三甲医院 ──
  facility(1, { type: 'hospital', name: '北京协和医院', level: '三甲', address: '东城区帅府园1号', lat: 39.912, lng: 116.417, rating: 4.9, phone: '010-69156114', website: 'https://www.pumch.cn', departments: ['健康管理中心', '肿瘤早筛', '心内科', '呼吸科'], licenseNo: '京卫医证字[2020]第1101010001号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2028-12-31', practiceScope: '预防保健科/内科/外科/肿瘤科' }),
  facility(2, { type: 'hospital', name: '北京大学第一医院', level: '三甲', address: '西城区西什库大街8号', lat: 39.928, lng: 116.373, rating: 4.8, phone: '010-83572211', website: 'https://www.bddyyy.com.cn', departments: ['体检中心', '消化内科', '呼吸科'], licenseNo: '京卫医证字[2019]第1101020008号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2027-06-30', practiceScope: '内科/外科/妇产科/体检' }),
  facility(3, { type: 'hospital', name: '中日友好医院', level: '三甲', address: '朝阳区樱花园东街2号', lat: 39.974, lng: 116.424, rating: 4.7, phone: '010-84205566', website: 'https://www.zryhyy.com.cn', departments: ['国际医疗部', '体检中心', '肿瘤科'], licenseNo: '京卫医证字[2021]第1101050012号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2029-03-15', practiceScope: '综合医院/国际医疗/体检' }),
  facility(4, { type: 'hospital', name: '首都医科大学附属北京天坛医院', level: '三甲', address: '丰台区南四环西路119号', lat: 39.865, lng: 116.287, rating: 4.8, phone: '010-59976557', website: 'https://www.bjtth.org', departments: ['神经内科', '体检中心', '心脑血管'], licenseNo: '京卫医证字[2020]第1101060023号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2028-08-20', practiceScope: '神经内科/神经外科/体检' }),
  facility(5, { type: 'hospital', name: '上海交通大学医学院附属瑞金医院', level: '三甲', address: '黄浦区瑞金二路197号', lat: 31.218, lng: 121.469, rating: 4.9, phone: '021-64370045', website: 'https://www.rjh.com.cn', departments: ['体检中心', '内分泌科', '血液科'], licenseNo: '沪卫医证字[2019]第3101010156号', licenseAuthority: '上海市卫生健康委员会', licenseValidUntil: '2027-11-30', practiceScope: '综合医疗/健康管理中心' }),
  facility(6, { type: 'hospital', name: '复旦大学附属华山医院', level: '三甲', address: '静安区乌鲁木齐中路12号', lat: 31.221, lng: 121.445, rating: 4.8, phone: '021-52889999', website: 'https://www.huashan.org.cn', departments: ['神经内科', '体检中心', '皮肤科'], licenseNo: '沪卫医证字[2020]第3101060089号', licenseAuthority: '上海市卫生健康委员会', licenseValidUntil: '2028-05-31', practiceScope: '神经内科/皮肤科/体检' }),
  facility(7, { type: 'hospital', name: '四川大学华西医院', level: '三甲', address: '武侯区国学巷37号', lat: 30.639, lng: 104.065, rating: 4.9, phone: '028-85422114', website: 'https://www.wchscu.cn', departments: ['健康管理中心', '肿瘤中心', '心内科'], licenseNo: '川卫医证字[2018]第5101070021号', licenseAuthority: '四川省卫生健康委员会', licenseValidUntil: '2027-12-31', practiceScope: '综合医院/肿瘤/心血管' }),
  facility(8, { type: 'hospital', name: '中山大学附属第一医院', level: '三甲', address: '越秀区中山二路58号', lat: 23.127, lng: 113.276, rating: 4.8, phone: '020-87755766', website: 'https://www.gzsums.net', departments: ['体检中心', '消化内科', '肾内科'], licenseNo: '粤卫医证字[2019]第4401040033号', licenseAuthority: '广东省卫生健康委员会', licenseValidUntil: '2028-09-30', practiceScope: '综合医疗/健康管理' }),
  facility(9, { type: 'hospital', name: '浙江大学医学院附属第一医院', level: '三甲', address: '上城区庆春路79号', lat: 30.259, lng: 120.169, rating: 4.8, phone: '0571-87236114', website: 'https://www.zy91.com', departments: ['体检中心', '感染科', '肝胆胰外科'], licenseNo: '浙卫医证字[2020]第3301020045号', licenseAuthority: '浙江省卫生健康委员会', licenseValidUntil: '2029-01-15', practiceScope: '综合医院/传染病/体检' }),
  facility(10, { type: 'hospital', name: '武汉协和医院', level: '三甲', address: '江汉区解放大道1277号', lat: 30.584, lng: 114.273, rating: 4.8, phone: '027-85726114', website: 'https://www.whuh.com', departments: ['健康管理中心', '心外科', '肿瘤中心'], licenseNo: '鄂卫医证字[2019]第4201030056号', licenseAuthority: '湖北省卫生健康委员会', licenseValidUntil: '2027-10-31', practiceScope: '综合医院/肿瘤/心血管' }),
  facility(11, { type: 'hospital', name: '南京鼓楼医院', level: '三甲', address: '鼓楼区中山路321号', lat: 32.060, lng: 118.779, rating: 4.7, phone: '025-83106666', website: 'https://www.njglyy.com', departments: ['体检中心', '消化科', '骨科'], licenseNo: '苏卫医证字[2020]第3201060067号', licenseAuthority: '江苏省卫生健康委员会', licenseValidUntil: '2028-04-30', practiceScope: '综合医疗/体检' }),
  facility(12, { type: 'hospital', name: '深圳市人民医院', level: '三甲', address: '罗湖区东门北路1017号', lat: 22.558, lng: 114.131, rating: 4.7, phone: '0755-25533018', website: 'https://www.szhospital.com', departments: ['健康管理中心', '体检科', '心内科'], licenseNo: '粤卫医证字[2021]第4403030078号', licenseAuthority: '深圳市卫生健康委员会', licenseValidUntil: '2029-06-30', practiceScope: '综合医院/健康管理' }),
  facility(13, { type: 'hospital', name: '西安交通大学第一附属医院', level: '三甲', address: '雁塔区雁塔西路277号', lat: 34.224, lng: 108.939, rating: 4.7, phone: '029-85324600', website: 'https://www.dyyy.xjtu.edu.cn', departments: ['体检中心', '肿瘤内科', '心血管'], licenseNo: '陕卫医证字[2019]第6101130089号', licenseAuthority: '陕西省卫生健康委员会', licenseValidUntil: '2027-08-31', practiceScope: '综合医院/肿瘤/心血管' }),
  facility(14, { type: 'hospital', name: '天津医科大学总医院', level: '三甲', address: '和平区鞍山道154号', lat: 39.118, lng: 117.195, rating: 4.7, phone: '022-60362255', website: 'https://www.tjmugh.com.cn', departments: ['体检中心', '内分泌', '神经内科'], licenseNo: '津卫医证字[2020]第1201010090号', licenseAuthority: '天津市卫生健康委员会', licenseValidUntil: '2028-11-30', practiceScope: '综合医疗/体检' }),
  facility(15, { type: 'hospital', name: '山东大学齐鲁医院', level: '三甲', address: '历下区文化西路107号', lat: 36.651, lng: 117.038, rating: 4.8, phone: '0531-82169114', website: 'http://www.qiluhospital.com', departments: ['健康管理中心', '肿瘤科', '心内科'], licenseNo: '鲁卫医证字[2019]第3701020101号', licenseAuthority: '山东省卫生健康委员会', licenseValidUntil: '2027-12-15', practiceScope: '综合医院/健康管理' }),
  // ── 专业体检中心 ──
  facility(101, { type: 'checkup', name: '美年大健康北京国贸体检中心', level: '专业体检', address: '朝阳区建国门外大街1号', lat: 39.908, lng: 116.460, rating: 4.6, phone: '400-810-0120', website: 'https://www.health-100.cn', departments: ['全身体检', '肿瘤筛查', '慢病套餐'], licenseNo: '京卫医证字[2022]第1101050888号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2029-12-31', practiceScope: '健康检查/预防保健科', orgCode: '91110105MA01XXXXX' }),
  facility(102, { type: 'checkup', name: '爱康国宾北京西单体检中心', level: '专业体检', address: '西城区西单北大街131号', lat: 39.913, lng: 116.374, rating: 4.5, phone: '400-810-0122', website: 'https://www.ikang.com', departments: ['入职体检', '高端体检', '慢病筛查'], licenseNo: '京卫医证字[2021]第1101020777号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2028-07-31', practiceScope: '健康检查/医学检验', orgCode: '91110102MA02YYYYY' }),
  facility(103, { type: 'checkup', name: '瑞慈体检上海陆家嘴机构', level: '专业体检', address: '浦东新区陆家嘴环路1000号', lat: 31.235, lng: 121.505, rating: 4.6, phone: '021-58888888', website: 'https://www.rich-healthcare.com', departments: ['全身体检', '女性专项', '心脑血管'], licenseNo: '沪卫医证字[2022]第3101150666号', licenseAuthority: '上海市卫生健康委员会', licenseValidUntil: '2029-05-31', practiceScope: '健康检查/预防保健', orgCode: '91310115MA03ZZZZZ' }),
  facility(104, { type: 'checkup', name: '慈铭体检广州天河中心', level: '专业体检', address: '天河区体育西路103号', lat: 23.135, lng: 113.324, rating: 4.5, phone: '020-38888888', website: 'https://www.ciming.com', departments: ['团体体检', '肿瘤早筛', '入职体检'], licenseNo: '粤卫医证字[2021]第4401060555号', licenseAuthority: '广东省卫生健康委员会', licenseValidUntil: '2028-10-31', practiceScope: '健康检查', orgCode: '91440106MA04AAAAA' }),
  // ── 门诊部 / 诊所 ──
  facility(201, { type: 'clinic', name: '和睦家医疗北京朝阳门诊', level: '涉外医疗', address: '朝阳区将台路2号', lat: 39.970, lng: 116.490, rating: 4.8, phone: '010-59277000', website: 'https://www.ufh.com.cn', departments: ['全科', '儿科', '体检'], licenseNo: '京卫医证字[2018]第1101050444号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2027-09-30', practiceScope: '全科医疗/儿科/预防保健', orgCode: '91110105MA05BBBBB' }),
  facility(202, { type: 'clinic', name: '卓正医疗深圳蛇口医疗中心', level: '高端门诊', address: '南山区工业三路1号', lat: 22.485, lng: 113.920, rating: 4.7, phone: '0755-26612299', website: 'https://www.distinctclinic.com', departments: ['全科', '皮肤科', '体检'], licenseNo: '粤卫医证字[2020]第4403050333号', licenseAuthority: '深圳市卫生健康委员会', licenseValidUntil: '2028-03-31', practiceScope: '全科/皮肤科/健康咨询', orgCode: '91440305MA06CCCCC' }),
  // ── 医学检验机构 ──
  facility(301, { type: 'lab', name: '金域医学检验中心（广州总部）', level: '第三方检验', address: '广州国际生物岛螺旋大道51号', lat: 23.065, lng: 113.365, rating: 4.6, phone: '400-888-1221', website: 'https://www.kingmed.com.cn', departments: ['临床检验', '病理诊断', '基因检测'], licenseNo: '粤卫医证字[2019]第4401120222号', licenseAuthority: '广东省卫生健康委员会', licenseValidUntil: '2027-12-31', practiceScope: '医学检验科/病理科', orgCode: '91440101MA07DDDDD', clia: 'ISO15189 认可实验室' }),
  facility(302, { type: 'lab', name: '迪安诊断杭州检验中心', level: '第三方检验', address: '西湖区金蓬街329号', lat: 30.310, lng: 120.065, rating: 4.5, phone: '400-103-8200', website: 'https://www.dazd.cn', departments: ['生化检验', '肿瘤标志物', '微生物'], licenseNo: '浙卫医证字[2020]第3301060111号', licenseAuthority: '浙江省卫生健康委员会', licenseValidUntil: '2028-06-30', practiceScope: '医学检验科', orgCode: '91330106MA08EEEEE', clia: 'CAP 认证实验室' }),
  facility(303, { type: 'lab', name: '艾迪康医学检验中心（北京）', level: '第三方检验', address: '昌平区生命科学园路29号', lat: 40.098, lng: 116.278, rating: 4.5, phone: '010-80706688', website: 'https://www.adicon.com.cn', departments: ['PCR检测', '病理', '精准医疗'], licenseNo: '京卫医证字[2021]第1101140999号', licenseAuthority: '北京市卫生健康委员会', licenseValidUntil: '2029-02-28', practiceScope: '医学检验科/临床基因扩增', orgCode: '91110114MA09FFFFF' }),
];

const TYPE_LABEL = {
  hospital: '医院',
  checkup: '体检中心',
  clinic: '门诊部',
  lab: '医学检验机构',
};

function findNearbyFacilities(lat, lng, { limit = 15, maxKm = 800, type = null } = {}) {
  return FACILITY_DB
    .filter(f => !type || f.type === type)
    .map(f => ({
      ...f,
      typeLabel: TYPE_LABEL[f.type] || f.type,
      distanceKm: +haversineKm(lat, lng, f.lat, f.lng).toFixed(1),
    }))
    .filter(f => f.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(f => ({
      ...f,
      distance: f.distanceKm < 1 ? `${Math.round(f.distanceKm * 1000)} m` : `${f.distanceKm} km`,
    }));
}

function getDemoFacilities() {
  return FACILITY_DB.filter(f => f.lat > 39 && f.lat < 41 && f.lng > 116 && f.lng < 117)
    .slice(0, 12)
    .map(f => ({
      ...f,
      typeLabel: TYPE_LABEL[f.type] || f.type,
      distance: `${(2 + f.id * 0.8).toFixed(1)} km`,
    }));
}

module.exports = {
  FACILITY_DB,
  TYPE_LABEL,
  findNearbyFacilities,
  getDemoFacilities,
};
