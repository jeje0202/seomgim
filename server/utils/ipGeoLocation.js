// IP 주소 기반 지역 정보 추출 유틸리티
const https = require('https');
const http = require('http');

// 국가명 한글 변환 맵
const countryKoreanMap = {
  'KR': '대한민국',
  'US': '미국',
  'CN': '중국',
  'JP': '일본',
  'GB': '영국',
  'DE': '독일',
  'FR': '프랑스',
  'IT': '이탈리아',
  'ES': '스페인',
  'RU': '러시아',
  'CA': '캐나다',
  'AU': '호주',
  'BR': '브라질',
  'IN': '인도',
  'MX': '멕시코',
  'ID': '인도네시아',
  'NL': '네덜란드',
  'TR': '터키',
  'SA': '사우디아라비아',
  'CH': '스위스',
  'AR': '아르헨티나',
  'SE': '스웨덴',
  'PL': '폴란드',
  'BE': '벨기에',
  'TH': '태국',
  'VN': '베트남',
  'PH': '필리핀',
  'MY': '말레이시아',
  'SG': '싱가포르',
  'TW': '대만',
  'HK': '홍콩',
  'NZ': '뉴질랜드',
  'NO': '노르웨이',
  'DK': '덴마크',
  'FI': '핀란드',
  'IE': '아일랜드',
  'PT': '포르투갈',
  'GR': '그리스',
  'CZ': '체코',
  'RO': '루마니아',
  'HU': '헝가리',
  'BG': '불가리아',
  'HR': '크로아티아',
  'SK': '슬로바키아',
  'SI': '슬로베니아',
  'EE': '에스토니아',
  'LT': '리투아니아',
  'LV': '라트비아',
  'UA': '우크라이나',
  'BY': '벨라루스',
  'KZ': '카자흐스탄',
  'EG': '이집트',
  'ZA': '남아프리카공화국',
  'NG': '나이지리아',
  'KE': '케냐',
  'IL': '이스라엘',
  'AE': '아랍에미리트',
  'QA': '카타르',
  'KW': '쿠웨이트',
  'OM': '오만',
  'JO': '요르단',
  'LB': '레바논',
  'IQ': '이라크',
  'IR': '이란',
  'PK': '파키스탄',
  'BD': '방글라데시',
  'LK': '스리랑카',
  'NP': '네팔',
  'MM': '미얀마',
  'KH': '캄보디아',
  'LA': '라오스',
  'BN': '브루나이',
  'CL': '칠레',
  'CO': '콜롬비아',
  'PE': '페루',
  'VE': '베네수엘라',
  'EC': '에콰도르',
  'UY': '우루과이',
  'PY': '파라과이',
  'BO': '볼리비아',
  'CR': '코스타리카',
  'PA': '파나마',
  'GT': '과테말라',
  'DO': '도미니카공화국',
  'CU': '쿠바',
  'JM': '자메이카',
  'TT': '트리니다드토바고',
  'BS': '바하마',
  'BB': '바베이도스',
  'AG': '앤티가바부다',
  'DM': '도미니카',
  'LC': '세인트루시아',
  'VC': '세인트빈센트그레나딘',
  'GD': '그레나다',
  'KN': '세인트키츠네비스',
  'BZ': '벨리즈',
  'SR': '수리남',
  'GY': '가이아나',
  'GF': '프랑스령기아나',
  'FK': '포클랜드제도',
  'GS': '사우스조지아사우스샌드위치제도',
  'TF': '프랑스남부영토',
  'AQ': '남극',
  'BV': '부베섬',
  'HM': '허드맥도널드제도',
  'IO': '영국령인도양영토',
  'CX': '크리스마스섬',
  'CC': '코코스제도',
  'NF': '노퍽섬',
  'PN': '핏케언제도',
  'SH': '세인트헬레나',
  'AC': '어센션섬',
  'TA': '트리스탄다쿠냐',
  'UM': '미국령소수도서',
  'AS': '아메리칸사모아',
  'GU': '괌',
  'MP': '북마리아나제도',
  'PR': '푸에르토리코',
  'VI': '미국령버진아일랜드',
  'VG': '영국령버진아일랜드',
  'AI': '앵귈라',
  'BM': '버뮤다',
  'KY': '케이맨제도',
  'MS': '몬트세랫',
  'TC': '터크스케이커스제도',
  'AW': '아루바',
  'CW': '퀴라소',
  'SX': '신트마르턴',
  'BQ': '카리브네덜란드',
  'BL': '생바르텔레미',
  'MF': '생마르탱',
  'GP': '과들루프',
  'MQ': '마르티니크',
  'RE': '레위니옹',
  'YT': '마요트',
  'PM': '생피에르미클롱',
  'WF': '왈리스푸투나',
  'PF': '프랑스령폴리네시아',
  'NC': '뉴칼레도니아',
  'VU': '바누아투',
  'NC': '뉴칼레도니아',
  'FJ': '피지',
  'TO': '통가',
  'WS': '사모아',
  'KI': '키리바시',
  'TV': '투발루',
  'NR': '나우루',
  'PW': '팔라우',
  'FM': '미크로네시아',
  'MH': '마셜제도',
  'SB': '솔로몬제도',
  'PG': '파푸아뉴기니',
  'TL': '동티모르',
  'MO': '마카오',
  'MN': '몽골',
  'KP': '북한',
  'AF': '아프가니스탄',
  'TJ': '타지키스탄',
  'TM': '투르크메니스탄',
  'UZ': '우즈베키스탄',
  'KG': '키르기스스탄',
  'GE': '조지아',
  'AM': '아르메니아',
  'AZ': '아제르바이잔',
  'MD': '몰도바',
  'AL': '알바니아',
  'MK': '북마케도니아',
  'ME': '몬테네그로',
  'RS': '세르비아',
  'BA': '보스니아헤르체고비나',
  'XK': '코소보',
  'IS': '아이슬란드',
  'LU': '룩셈부르크',
  'MT': '몰타',
  'CY': '키프로스',
  'AD': '안도라',
  'MC': '모나코',
  'SM': '산마리노',
  'VA': '바티칸',
  'LI': '리히텐슈타인',
  'FO': '페로제도',
  'GI': '지브롤터',
  'AX': '올란드제도',
  'SJ': '스발바르얀마옌',
  'GL': '그린란드',
  'EH': '서사하라',
  'MA': '모로코',
  'DZ': '알제리',
  'TN': '튀니지',
  'LY': '리비아',
  'SD': '수단',
  'SS': '남수단',
  'ET': '에티오피아',
  'ER': '에리트레아',
  'DJ': '지부티',
  'SO': '소말리아',
  'UG': '우간다',
  'TZ': '탄자니아',
  'RW': '르완다',
  'BI': '부룬디',
  'MW': '말라위',
  'ZM': '잠비아',
  'ZW': '짐바브웨',
  'BW': '보츠와나',
  'NA': '나미비아',
  'SZ': '에스와티니',
  'LS': '레소토',
  'MZ': '모잠비크',
  'MG': '마да가스카르',
  'MU': '모리셔스',
  'SC': '세이셸',
  'KM': '코모로',
  'CV': '카보베르데',
  'ST': '상투메프린시페',
  'GW': '기니비사우',
  'GN': '기니',
  'SL': '시에라리온',
  'LR': '라이베리아',
  'CI': '코트디부아르',
  'GH': '가나',
  'TG': '토고',
  'BJ': '베냉',
  'NE': '니제르',
  'BF': '부르키나파소',
  'ML': '말리',
  'SN': '세네갈',
  'GM': '감비아',
  'MR': '모리타니',
  'TD': '차드',
  'CM': '카메룬',
  'CF': '중앙아프리카공화국',
  'GQ': '적도기니',
  'GA': '가봉',
  'CG': '콩고',
  'CD': '콩고민주공화국',
  'AO': '앙골라',
  'ZM': '잠비아',
  'MW': '말라위',
  'MZ': '모잠비크',
  'MG': '마다가스카르',
  'MU': '모리셔스',
  'SC': '세이셸',
  'KM': '코모로',
  'YT': '마요트',
  'RE': '레위니옹',
  'SH': '세인트헬레나',
  'AC': '어센션섬',
  'TA': '트리스탄다쿠냐',
  'BV': '부베섬',
  'GS': '사우스조지아사우스샌드위치제도',
  'TF': '프랑스남부영토',
  'HM': '허드맥도널드제도',
  'AQ': '남극',
  'IO': '영국령인도양영토',
  'CX': '크리스마스섬',
  'CC': '코코스제도',
  'NF': '노퍽섬',
  'PN': '핏케언제도',
  'UM': '미국령소수도서',
  'AS': '아메리칸사모아',
  'GU': '괌',
  'MP': '북마리아나제도',
  'PR': '푸에르토리코',
  'VI': '미국령버진아일랜드',
  'VG': '영국령버진아일랜드',
  'AI': '앵귈라',
  'BM': '버뮤다',
  'KY': '케이맨제도',
  'MS': '몬트세랫',
  'TC': '터크스케이커스제도',
  'AW': '아루바',
  'CW': '퀴라소',
  'SX': '신트마르턴',
  'BQ': '카리브네덜란드',
  'BL': '생바르텔레미',
  'MF': '생마르탱',
  'GP': '과들루프',
  'MQ': '마르티니크',
  'RE': '레위니옹',
  'YT': '마요트',
  'PM': '생피에르미클롱',
  'WF': '왈리스푸투나',
  'PF': '프랑스령폴리네시아',
  'NC': '뉴칼레도니아',
  'VU': '바누아투',
  'FJ': '피지',
  'TO': '통가',
  'WS': '사모아',
  'KI': '키리바시',
  'TV': '투발루',
  'NR': '나우루',
  'PW': '팔라우',
  'FM': '미크로네시아',
  'MH': '마셜제도',
  'SB': '솔로몬제도',
  'PG': '파푸아뉴기니',
  'TL': '동티모르',
  'MO': '마카오',
  'MN': '몽골',
  'KP': '북한',
  'AF': '아프가니스탄',
  'TJ': '타지키스탄',
  'TM': '투르크메니스탄',
  'UZ': '우즈베키스탄',
  'KG': '키르기스스탄',
  'GE': '조지아',
  'AM': '아르메니아',
  'AZ': '아제르바이잔',
  'MD': '몰도바',
  'AL': '알바니아',
  'MK': '북마케도니아',
  'ME': '몬테네그로',
  'RS': '세르비아',
  'BA': '보스니아헤르체고비나',
  'XK': '코소보',
  'IS': '아이슬란드',
  'LU': '룩셈부르크',
  'MT': '몰타',
  'CY': '키프로스',
  'AD': '안도라',
  'MC': '모나코',
  'SM': '산마리노',
  'VA': '바티칸',
  'LI': '리히텐슈타인',
  'FO': '페로제도',
  'GI': '지브롤터',
  'AX': '올란드제도',
  'SJ': '스발바르얀마옌',
  'GL': '그린란드',
  'EH': '서사하라',
  'MA': '모로코',
  'DZ': '알제리',
  'TN': '튀니지',
  'LY': '리비아',
  'SD': '수단',
  'SS': '남수단',
  'ET': '에티오피아',
  'ER': '에리트레아',
  'DJ': '지부티',
  'SO': '소말리아',
  'UG': '우간다',
  'TZ': '탄자니아',
  'RW': '르완다',
  'BI': '부룬디',
  'MW': '말라위',
  'ZM': '잠비아',
  'ZW': '짐바브웨',
  'BW': '보츠와나',
  'NA': '나미비아',
  'SZ': '에스와티니',
  'LS': '레소토',
  'MZ': '모잠비크',
  'MG': '마다가스카르',
  'MU': '모리셔스',
  'SC': '세이셸',
  'KM': '코모로',
  'CV': '카보베르데',
  'ST': '상투메프린시페',
  'GW': '기니비사우',
  'GN': '기니',
  'SL': '시에라리온',
  'LR': '라이베리아',
  'CI': '코트디부아르',
  'GH': '가나',
  'TG': '토고',
  'BJ': '베냉',
  'NE': '니제르',
  'BF': '부르키나파소',
  'ML': '말리',
  'SN': '세네갈',
  'GM': '감비아',
  'MR': '모리타니',
  'TD': '차드',
  'CM': '카메룬',
  'CF': '중앙아프리카공화국',
  'GQ': '적도기니',
  'GA': '가봉',
  'CG': '콩고',
  'CD': '콩고민주공화국',
  'AO': '앙골라'
};

// 한국 지역명 한글 변환 맵
const koreanRegionMap = {
  'Seoul': '서울특별시',
  'Busan': '부산광역시',
  'Daegu': '대구광역시',
  'Incheon': '인천광역시',
  'Gwangju': '광주광역시',
  'Daejeon': '대전광역시',
  'Ulsan': '울산광역시',
  'Sejong': '세종특별자치시',
  'Gyeonggi': '경기도',
  'Gangwon': '강원도',
  'Chungbuk': '충청북도',
  'Chungnam': '충청남도',
  'Jeonbuk': '전라북도',
  'Jeonnam': '전라남도',
  'Gyeongbuk': '경상북도',
  'Gyeongnam': '경상남도',
  'Jeju': '제주특별자치도'
};

/**
 * 국가명을 한글로 변환
 */
function translateCountryToKorean(countryName, countryCode) {
  if (countryCode && countryKoreanMap[countryCode]) {
    return countryKoreanMap[countryCode];
  }
  // API에서 이미 한글로 반환된 경우 그대로 사용
  if (countryName && /[가-힣]/.test(countryName)) {
    return countryName;
  }
  // 영어 국가명인 경우 코드로 변환 시도
  return countryName || '알 수 없음';
}

/**
 * 지역명을 한글로 변환 (한국 지역)
 */
function translateRegionToKorean(regionName, countryCode) {
  if (!regionName) return '';
  
  // 한국인 경우 지역명 한글 변환
  if (countryCode === 'KR' && koreanRegionMap[regionName]) {
    return koreanRegionMap[regionName];
  }
  
  // 이미 한글로 된 경우 그대로 사용
  if (/[가-힣]/.test(regionName)) {
    return regionName;
  }
  
  return regionName;
}

// IP 지역 정보 캐시 (같은 IP를 반복 조회하는 것을 방지)
const ipCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

/**
 * IP 주소로부터 지역 정보 추출
 * @param {string} ip IP 주소
 * @returns {Promise<{country: string, region: string, city: string, isp: string, timezone: string}>}
 */
async function getLocationFromIP(ip) {
  // 로컬 IP나 유효하지 않은 IP는 처리하지 않음
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: '로컬',
      region: '로컬',
      city: '로컬',
      isp: '로컬',
      timezone: '로컬'
    };
  }

  // 캐시 확인
  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // ip-api.com 무료 API 사용 (분당 45회 제한)
    // 더 상세한 정보를 위해 lat, lon, zip, countryCode 등 추가 필드 포함
    const url = `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,asname,timezone,query&lang=ko`;
    
    const locationData = await new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === 'success') {
              // 국가명 한글 변환 (주요 국가)
              const countryName = translateCountryToKorean(json.country, json.countryCode);
              
              // 지역명 한글 변환 (한국 지역)
              const regionName = translateRegionToKorean(json.regionName, json.countryCode);
              
              // 상세 위치 정보 구성
              let locationDetail = countryName;
              if (regionName && regionName !== countryName) {
                locationDetail += ` > ${regionName}`;
              }
              if (json.city && json.city !== regionName) {
                locationDetail += ` > ${json.city}`;
              }
              if (json.zip) {
                locationDetail += ` (${json.zip})`;
              }
              
              resolve({
                country: countryName,
                countryCode: json.countryCode || '',
                region: regionName || json.regionName || '알 수 없음',
                regionCode: json.region || '',
                city: json.city || '알 수 없음',
                zip: json.zip || '',
                latitude: json.lat || null,
                longitude: json.lon || null,
                isp: json.isp || '알 수 없음',
                org: json.org || '',
                as: json.as || '',
                asname: json.asname || '',
                timezone: json.timezone || '알 수 없음',
                locationDetail: locationDetail
              });
            } else {
              reject(new Error(json.message || '지역 정보를 가져올 수 없습니다.'));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });

    // 캐시에 저장
    ipCache.set(ip, {
      data: locationData,
      timestamp: Date.now()
    });

    return locationData;
  } catch (error) {
    console.error(`[IP 지역 정보] IP ${ip} 조회 오류:`, error.message);
    // 오류 발생 시 기본값 반환
    const defaultData = {
      country: '알 수 없음',
      countryCode: '',
      region: '알 수 없음',
      regionCode: '',
      city: '알 수 없음',
      zip: '',
      latitude: null,
      longitude: null,
      isp: '알 수 없음',
      org: '',
      as: '',
      asname: '',
      timezone: '알 수 없음',
      locationDetail: '알 수 없음'
    };
    
    // 캐시에 저장 (오류도 캐시하여 반복 조회 방지)
    ipCache.set(ip, {
      data: defaultData,
      timestamp: Date.now()
    });
    
    return defaultData;
  }
}

/**
 * 여러 IP 주소의 지역 정보를 일괄 조회
 * @param {string[]} ips IP 주소 배열
 * @returns {Promise<Map<string, object>>} IP별 지역 정보 맵
 */
async function getLocationsFromIPs(ips) {
  const locationMap = new Map();
  
  // 중복 제거
  const uniqueIPs = [...new Set(ips)];
  
  // 병렬 조회 (너무 많은 요청을 방지하기 위해 배치 처리)
  const batchSize = 10;
  for (let i = 0; i < uniqueIPs.length; i += batchSize) {
    const batch = uniqueIPs.slice(i, i + batchSize);
    const promises = batch.map(async (ip) => {
      const location = await getLocationFromIP(ip);
      return { ip, location };
    });
    
    const results = await Promise.allSettled(promises);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        locationMap.set(result.value.ip, result.value.location);
      }
    });
    
    // API 제한을 고려하여 배치 간 약간의 지연
    if (i + batchSize < uniqueIPs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return locationMap;
}

module.exports = {
  getLocationFromIP,
  getLocationsFromIPs
};

