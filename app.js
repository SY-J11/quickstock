
const API = 'https://m.stock.naver.com';
const PROXY_BASE = 'https://stock-insight-proxy.mcraft-tiger-574.workers.dev';

const seed = [
  {name:'삼성전자',code:'005930'},
  {name:'삼성전자우',code:'005935'},
  {name:'SK하이닉스',code:'000660'},
  {name:'한미반도체',code:'042700'},
  {name:'두산에너빌리티',code:'034020'},
  {name:'두산',code:'000150'},
  {name:'현대차',code:'005380'},
  {name:'기아',code:'000270'},
  {name:'LG에너지솔루션',code:'373220'},
  {name:'삼성SDI',code:'006400'},
  {name:'NAVER',code:'035420'},
  {name:'카카오',code:'035720'},
  {name:'제주반도체',code:'080220'},
  {name:'대원전선',code:'006340'},
  {name:'대덕전자',code:'353200'}
];

const $ = id => document.getElementById(id);
const blank = '—';

let current = {...seed[0]};
let timer = null;
let seq = 0;

function num(v) {
  if (v === null || v === undefined || v === '') return null;

  if (typeof v === 'object') {
    v = v.value ?? v.formattedValue ?? v.text ??
        v.price ?? v.amount ?? v.rawValue;
  }

  if (v === null || v === undefined || v === '') return null;

  let s = String(v).trim();
  if (!s || s === '-' || s === 'N/A' || s === '자료없음') return null;

  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[(),]/g, '')
       .replace(/%|원|배|주|명/g, '')
       .trim();

  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

function fmt(v, unit = '') {
  const n = num(v);
  return n === null
    ? blank
    : n.toLocaleString('ko-KR', {maximumFractionDigits:2}) + unit;
}

function objects(root, out = [], seen = new Set()) {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;

  seen.add(root);

  if (Array.isArray(root)) {
    root.forEach(v => objects(v, out, seen));
  } else {
    out.push(root);
    Object.values(root).forEach(v => {
      if (v && typeof v === 'object') objects(v, out, seen);
    });
  }

  return out;
}

async function getJson(url) {
  const urls = [
    `${PROXY_BASE}?url=${encodeURIComponent(url)}`,
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  let lastError;

  for (const target of urls) {
    try {
      const response = await fetch(target, {
        cache: 'no-store',
        headers: {Accept:'application/json'}
      });

      if (!response.ok) throw Error(`HTTP ${response.status}`);

      const raw = await response.text();
      const data = JSON.parse(raw);

      if (data?.error) throw Error(data.error);

      return data;
    } catch (e) {
      lastError = e;
    }
  }

  throw Error(lastError?.message || 'API 요청 실패');
}

async function first(urls) {
  let lastError;

  for (const url of urls) {
    try {
      return await getJson(url);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || Error('조회 실패');
}

function findDeep(root, keys) {
  const list = objects(root);

  for (const key of keys) {
    for (const obj of list) {
      if (obj[key] !== undefined && obj[key] !== null &&
          obj[key] !== '' && typeof obj[key] !== 'object') {
        return obj[key];
      }
    }
  }

  return null;
}

/*
 * 네이버 integration 응답의 totalInfos 배열을
 * 일반 객체와 같은 방식으로 지표 추출에 활용한다.
 */
function metricValue(raw, keys, titleNames = []) {
  const list = objects(raw);

  for (const key of keys) {
    for (const obj of list) {
      if (obj[key] !== undefined && obj[key] !== null &&
          obj[key] !== '' && typeof obj[key] !== 'object') {
        return obj[key];
      }
    }
  }

  const normalizedTitles = titleNames.map(x =>
    String(x).replace(/\s/g, '').toLowerCase()
  );

  for (const obj of list) {
    const title = String(
      obj.codeName ?? obj.title ?? obj.name ??
      obj.itemName ?? obj.keyName ?? obj.label ?? ''
    ).replace(/\s/g, '').toLowerCase();

    if (!title || !normalizedTitles.includes(title)) continue;

    for (const key of [
      'value', 'formattedValue', 'data', 'price',
      'rawValue', 'result', 'content'
    ]) {
      if (obj[key] !== undefined && obj[key] !== null) {
        const n = num(obj[key]);
        if (n !== null) return obj[key];
      }
    }
  }

  return null;
}

function extractBasic(basic, integration, code, name) {
  const source = {
    basic: basic || {},
    integration: integration || {}
  };

  const price = findDeep(basic, [
    'closePrice', 'currentPrice', 'nowPrice', 'tradePrice'
  ]);

  const change = findDeep(basic, [
    'compareToPreviousClosePrice', 'changePrice',
    'compareToPreviousPrice'
  ]);

  const rate = findDeep(basic, [
    'fluctuationsRatio', 'changeRate'
  ]);

  const per = metricValue(source, ['per','PER'], ['PER']);
  const pbr = metricValue(source, ['pbr','PBR'], ['PBR']);
  const eps = metricValue(source, ['eps','EPS'], ['EPS']);

  const cap = metricValue(
    source,
    ['marketValue','marketCap','marketSum','marketCapitalization'],
    ['시가총액','시가총액(억)','시가총액(조)']
  );

  const roe = metricValue(source, ['roe','ROE'], ['ROE']);
  const debt = metricValue(
    source,
    ['debtRatio','debtRate','debtRatioRate'],
    ['부채비율']
  );

  const foreignFloat = metricValue(
    source,
    ['foreignRate','foreignOwnershipRate','foreignRatio',
     'foreignExhaustionRate'],
    ['외국인소진율','외국인보유비율']
  );

  const target = metricValue(
    source,
    ['meanTargetPrice','priceTargetMean','targetPriceMean',
     'averageTargetPrice'],
    ['목표주가','목표가평균']
  );

  const opinion = metricValue(
    source,
    ['recommMean','investmentOpinion','meanOpinion',
     'investmentOpinionText'],
    ['투자의견','평균투자의견']
  );

  const annualMultiple = metricValue(
    source, ['annualMultiple'], ['연간멀티플']
  );

  const ttmMultiple = metricValue(
    source, ['ttmMultiple'], ['최근4분기멀티플']
  );

  const estTtmMultiple = metricValue(
    source, ['estTtmMultiple','cnsPer','estimatedPER'],
    ['추정PER','추정PER(배)']
  );

  let marketCap = null;

  if (cap !== null) {
    const text = String(cap);

    // 네이버는 시가총액을 "1,043조 6,322억" 형태로도 반환한다.
    const trillion = text.match(/([\d,.]+)\s*조/);
    const billion = text.match(/([\d,.]+)\s*억/);

    if (trillion || billion) {
      marketCap =
        (trillion ? Number(trillion[1].replace(/,/g,'')) * 10000 : 0) +
        (billion ? Number(billion[1].replace(/,/g,'')) : 0);
    } else {
      marketCap = num(cap);
    }
  }

  let capText = blank;

  if (marketCap !== null) {
    capText = marketCap >= 10000
      ? `${(marketCap / 10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}조`
      : `${marketCap.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;
  }

  const changeNum = num(change);
  const rateNum = num(rate);

  let changeText = '시세 정보 없음';

  if (changeNum !== null) {
    const sign = changeNum > 0 ? '+' : '';
    const arrow = changeNum > 0 ? '▲' : changeNum < 0 ? '▼' : '•';

    changeText = `${arrow} ${sign}${changeNum.toLocaleString('ko-KR')}`;

    if (rateNum !== null) {
      changeText += ` (${rateNum > 0 ? '+' : ''}${rateNum}%)`;
    }
  } else if (rateNum !== null) {
    changeText = `${rateNum > 0 ? '▲ +' : rateNum < 0 ? '▼ ' : '• '}${rateNum}%`;
  }

  return {
    name: findDeep(basic, ['stockName','itemName','name']) || name,
    code,
    price: fmt(price),
    change: changeText,
    per: fmt(per, '배'),
    pbr: fmt(pbr, '배'),
    eps: fmt(eps, '원'),
    cap: capText,
    roe: fmt(roe, '%'),
    debt: fmt(debt, '%'),
    foreignFloat: fmt(foreignFloat, '%'),
    target: fmt(target, '원'),
    opinion: opinion ?? blank,
    annualMultiple: fmt(annualMultiple, '배'),
    ttmMultiple: fmt(ttmMultiple, '배'),
    estTtmMultiple: fmt(estTtmMultiple, '배')
  };
}

function findFinanceRows(raw) {
  const rows = [];

  for (const obj of objects(raw)) {
    const label = String(
      obj.title ?? obj.name ?? obj.itemName ??
      obj.keyName ?? obj.label ?? obj.codeName ?? ''
    ).replace(/\s/g, '');

    if (!label) continue;

    if (/영업이익률|영업이익|매출액|당기순이익|순이익|EPS|주당순이익/.test(label)) {
      rows.push({label, obj});
    }
  }

  return rows;
}

function findPeriodHeaders(raw) {
  const result = [];

  for (const obj of objects(raw)) {
    for (const key of [
      'trTitleList','titleList','periodList','columnList','headers'
    ]) {
      if (!Array.isArray(obj[key])) continue;

      const candidate = obj[key].map(item => {
        if (typeof item === 'string') {
          return {key:item, label:item, est:/\(E\)/.test(item)};
        }

        if (!item || typeof item !== 'object') return null;

        const label = String(
          item.title ?? item.period ?? item.date ??
          item.key ?? item.name ?? ''
        );

        return {
          key: String(item.key ?? item.period ?? item.title ??
                      item.date ?? label),
          label,
          est: !!(item.isConsensus || item.consensus ||
                  /\(E\)/i.test(label))
        };
      }).filter(x => x && x.key);

      if (candidate.length > result.length) {
        result.length = 0;
        result.push(...candidate);
      }
    }
  }

  return result;
}

function rowValues(row) {
  if (!row) return [];

  const obj = row.obj;

  for (const key of ['columns','values','data','valueList','financeData']) {
    const source = obj[key];

    if (!source) continue;

    if (Array.isArray(source)) {
      const result = source.map((item, i) => ({
        period: String(item.period ?? item.date ?? item.title ?? i),
        value: num(item.value ?? item.formattedValue ?? item.data ?? item)
      }));

      if (result.some(x => x.value !== null)) return result;
    }

    if (typeof source === 'object') {
      const result = Object.entries(source).map(([period, value]) => ({
        period,
        value: num(value?.value ?? value?.formattedValue ?? value?.data ?? value)
      })).filter(x => x.value !== null);

      if (result.length) return result;
    }
  }

  return [];
}

function financeParse(raw) {
  const rows = findFinanceRows(raw);
  const headers = findPeriodHeaders(raw);

  const rowFor = re => rows.find(row => re.test(row.label));

  const op = rowFor(/^영업이익$/);
  const margin = rowFor(/영업이익률/);
  const sales = rowFor(/매출액/);
  const net = rowFor(/당기순이익|순이익/);
  const eps = rowFor(/EPS|주당순이익/);

  const get = (row, period) => {
    if (!row) return null;

    const obj = row.obj;

    const sources = [
      obj.columns, obj.values, obj.data, obj.valueList,
      obj.financeData
    ];

    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;

      if (Array.isArray(source)) {
        const match = source.find(x =>
          String(x.period ?? x.date ?? x.title ?? x.key) === period.key
        );

        if (match) {
          const value = num(
            match.value ?? match.formattedValue ?? match.data
          );
          if (value !== null) return value;
        }
      } else {
        const value = source[period.key];

        if (value !== undefined) {
          const n = num(value?.value ?? value?.formattedValue ??
                        value?.data ?? value);

          if (n !== null) return n;
        }
      }
    }

    const direct = obj[period.key];

    if (direct !== undefined) {
      const n = num(direct?.value ?? direct?.formattedValue ?? direct);
      if (n !== null) return n;
    }

    return null;
  };

  let quarters = [];

  if (headers.length) {
    quarters = headers.slice(-6).map(period => {
      const profit = get(op, period);
      const salesValue = get(sales, period);
      let marginValue = get(margin, period);

      if (marginValue === null && profit !== null &&
          salesValue !== null && salesValue !== 0) {
        marginValue = profit / salesValue * 100;
      }

      return {
        label: period.label.replace(/\.$/, ''),
        profit,
        margin: marginValue,
        eps: get(eps, period),
        net: get(net, period)
      };
    });
  }

  // API가 기간 헤더를 제공하지 않는 경우, 행에 직접 들어 있는
  // 기간별 값만 사용한다. 서로 다른 행의 순서를 무조건 맞추지 않는다.
  if (!quarters.length && op) {
    const ov = rowValues(op);
    const mv = rowValues(margin);
    const sv = rowValues(sales);
    const nv = rowValues(net);
    const ev = rowValues(eps);

    quarters = ov.slice(-6).map(item => {
      const match = arr => arr.find(x => x.period === item.period);
      const m = match(mv);
      const s = match(sv);
      const n = match(nv);
      const e = match(ev);

      return {
        label: item.period,
        profit: item.value,
        margin: m?.value ??
          (s?.value ? item.value / s.value * 100 : null),
        net: n?.value ?? null,
        eps: e?.value ?? null
      };
    });
  }

  return {quarters, rows};
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[ch]);
}

function renderChart(quarters) {
  const chart = $('chart');
  const labels = $('labels');

  const qs = (quarters || []).slice(-6);

  if (!qs.length || qs.every(q => q.profit === null)) {
    chart.innerHTML =
      '<div class="chart-empty">분기 영업이익 데이터를 확인할 수 없습니다.</div>';
    labels.innerHTML = '';
    return;
  }

  const vals = qs.map(q => q.profit).filter(v => v !== null);
  const maxP = Math.max(0, ...vals);
  const maxN = Math.max(0, ...vals.map(v => -v));

  const top = 35;
  const bottom = 205;
  const h = bottom - top;

  const zero = maxP && maxN
    ? top + h * maxP / (maxP + maxN)
    : maxP ? bottom : top;

  const y = v => v >= 0
    ? zero - (maxP ? v / maxP * (zero - top) : 0)
    : zero + (maxN ? -v / maxN * (bottom - zero) : 0);

  const svg = qs.map((q, i) => {
    const x = (i + 0.5) * 600 / qs.length;
    const v = q.profit;

    if (v === null) {
      return `<g>
        <text x="${x}" y="120" text-anchor="middle"
          font-size="9" fill="currentColor">자료 없음</text>
      </g>`;
    }

    const yy = y(v);
    const bh = Math.max(2, Math.abs(zero - yy));
    const by = v < 0 ? zero : yy;

    const amount = Math.abs(v) >= 10000
      ? `${(v / 10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}조`
      : `${v.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;

    const marginText = q.margin === null
      ? '(—)'
      : `(${q.margin.toLocaleString('ko-KR',{maximumFractionDigits:1})}%)`;

    const amountY = v >= 0
      ? Math.max(12, by - 8)
      : Math.min(220, by + bh + 13);

    const marginY = v >= 0
      ? Math.max(24, by - 21)
      : Math.min(235, by + bh + 25);

    return `<g>
      <rect x="${x-22}" y="${by}" width="44" height="${bh}"
        rx="3" fill="${v < 0 ? '#3979d8' : '#df5967'}"
        opacity="${/\(E\)/i.test(q.label) ? 0.75 : 1}"/>
      <text x="${x}" y="${amountY}" text-anchor="middle"
        font-size="10" font-weight="700" fill="currentColor">${amount}</text>
      <text x="${x}" y="${marginY}" text-anchor="middle"
        font-size="9" fill="#929baa">${marginText}</text>
    </g>`;
  }).join('');

  chart.innerHTML = `<svg class="profit-svg"
    viewBox="0 0 600 242" preserveAspectRatio="none" role="img">
    <line x1="0" y1="${zero}" x2="600" y2="${zero}"
      stroke="#929baa" stroke-dasharray="3 3"/>
    ${svg}
  </svg>`;

  labels.innerHTML = qs.map(q =>
    `<span>${escapeHtml(q.label || '—')}</span>`
  ).join('');
}

function render(data) {
  current = {...current, ...data};

  $('name').textContent = data.name || '종목명';
  $('code').textContent = data.code || '';

  $('price').childNodes[0].textContent = (data.price || blank) + ' ';
  $('change').textContent = data.change || '시세 정보 없음';

  const fields = [
    'per','pbr','eps','cap','annualOp','ttmOp','ttmNet',
    'roe','debt','foreignFloat','annualMultiple',
    'ttmMultiple','estTtmMultiple','target','opinion'
  ];

  fields.forEach(key => {
    if ($(key)) $(key).textContent = data[key] || blank;
  });

  const changeText = data.change || '';
  $('change').style.color =
    /▲|\+/.test(changeText) ? '#df5967' :
    /▼|-/.test(changeText) ? '#3979d8' : '';

  $('price').style.color = $('change').style.color || 'var(--text)';

  $('epsRows').innerHTML = (data.epsRows || []).map(row =>
    `<div>${escapeHtml(row[0])}<b>${escapeHtml(row[1])}</b></div>`
  ).join('') || '<div>분기 EPS 자료 없음</div>';

  renderChart(data.quarters || []);
}

function normalize(item) {
  const code = String(
    item.code || item.itemCode || item.stockCode ||
    item.reutersCode || ''
  ).replace(/\D/g, '');

  return code
    ? {name:item.name || item.stockName || item.itemName || code,
       code:code.padStart(6,'0')}
    : null;
}

async function search(query) {
  if (/^\d{6}$/.test(query)) {
    return [{
      name:seed.find(x => x.code === query)?.name || query,
      code:query
    }];
  }

  const data = await first([
    `${API}/front-api/search/autoComplete?query=${encodeURIComponent(query)}&target=stock,index,marketindicator,coin,ipo`
  ]);

  const items = data?.result?.items ||
                data?.items ||
                data?.result || [];

  return (Array.isArray(items) ? items : [])
    .map(normalize)
    .filter(Boolean)
    .slice(0, 12);
}

function showResults(items, query, message = '') {
  const box = $('results');
  box.hidden = !query;

  if (message) {
    box.innerHTML = `<div class="result">${escapeHtml(message)}</div>`;
    return;
  }

  if (!items.length) {
    box.innerHTML = '<div class="result">검색 결과가 없습니다.</div>';
    return;
  }

  box.innerHTML = items.map(item =>
    `<button class="result" data-code="${item.code}"
      data-name="${escapeHtml(item.name)}">
      ${escapeHtml(item.name)}<small>${item.code}</small> ›
    </button>`
  ).join('');

  box.querySelectorAll('[data-code]').forEach(button => {
    button.onclick = () => load(button.dataset.code, button.dataset.name);
  });
}

async function load(code, name = '') {
  const id = ++seq;
  const known = seed.find(x => x.code === code);

  current = {code, name:name || known?.name || code};

  $('name').textContent = current.name;
  $('code').textContent = code;
  $('change').textContent = '데이터 조회 중…';
  $('status').textContent = '네이버 증권 데이터 조회 중…';
  $('query').value = current.name;
  $('results').hidden = true;

  $('chart').innerHTML =
    '<div class="chart-empty">분기 재무 데이터 조회 중…</div>';

  try {
    const endpoints = await Promise.allSettled([
      first([
        `${API}/api/stock/${code}/basic`,
        `${API}/front-api/stock/domestic/basic?code=${code}&endType=stock`
      ]),
      first([
        `${API}/api/stock/${code}/integration`,
        `${API}/front-api/stock/domestic/integration?code=${code}&endType=stock`
      ]),
      first([
        `${API}/api/stock/${code}/finance/quarter`
      ]),
      first([
        `${API}/api/stock/${code}/finance/annual`
      ])
    ]);

    if (id !== seq) return;

    const basic = endpoints[0].status === 'fulfilled'
      ? endpoints[0].value : null;

    const integration = endpoints[1].status === 'fulfilled'
      ? endpoints[1].value : null;

    const quarter = endpoints[2].status === 'fulfilled'
      ? endpoints[2].value : null;

    const annual = endpoints[3].status === 'fulfilled'
      ? endpoints[3].value : null;

    if (!basic && !integration) {
      throw Error('기본 시세 API에 연결할 수 없습니다.');
    }

    const b = extractBasic(basic, integration, code, current.name);

    const q = financeParse(quarter);
    const a = financeParse(annual);
    const iq = financeParse(integration);

    const allQ = q.quarters.length ? q.quarters : iq.quarters;

    const annualRow = a.rows.find(x => /^영업이익$/.test(x.label));

    let annualOp = null;

    if (annualRow) {
      const values = rowValues(annualRow);
      if (values.length) annualOp = values[values.length - 1].value;
    }

    const lastFour = allQ.slice(-4);
    const opValues = lastFour.map(x => x.profit);
    const netValues = lastFour.map(x => x.net);

    const validOp = opValues.filter(x => x !== null);
    const validNet = netValues.filter(x => x !== null);

    // 최근 4개 분기의 영업이익과 순이익이 모두 확인되는 경우만
    // 합계를 표시한다. 누락된 분기를 0으로 처리하지 않는다.
    const ttmOp = lastFour.length === 4 &&
      validOp.length === 4
      ? validOp.reduce((sum, value) => sum + value, 0)
      : null;

    const ttmNet = lastFour.length === 4 &&
      validNet.length === 4
      ? validNet.reduce((sum, value) => sum + value, 0)
      : null;

    if (annualOp !== null) {
      b.annualOp = `${annualOp.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;
    }

    if (ttmOp !== null) {
      b.ttmOp = `${ttmOp.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;
    }

    if (ttmNet !== null) {
      const marginText = ttmOp !== null && ttmOp !== 0
        ? ` (${(ttmNet / ttmOp * 100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%)`
        : '';

      b.ttmNet = `${ttmNet.toLocaleString('ko-KR',{maximumFractionDigits:1})}억${marginText}`;
    }

    b.quarters = allQ;
    b.epsRows = allQ.slice(-6).map(x => [
      x.label,
      x.eps === null ? blank :
        x.eps.toLocaleString('ko-KR',{maximumFractionDigits:1})
    ]);

    $('status').textContent = [
      endpoints[0].status === 'fulfilled' ? '기본정보 연결됨' : '기본정보 실패',
      endpoints[1].status === 'fulfilled' ? '통합정보 연결됨' : '통합정보 실패',
      endpoints[2].status === 'fulfilled' ? '분기재무 연결됨' : '분기재무 미연결',
      endpoints[3].status === 'fulfilled' ? '연간재무 연결됨' : '연간재무 미연결'
    ].join(' · ');

    render(b);

  } catch (error) {
    if (id !== seq) return;

    $('status').textContent = `조회 오류: ${error.message}`;

    render({
      name:current.name,
      code,
      change:`조회 실패: ${error.message}`,
      quarters:[]
    });
  }
}

$('searchBtn').onclick = async () => {
  const query = $('query').value.trim();
  if (!query) return;

  try {
    const results = await search(query);

    if (results.length === 1) {
      load(results[0].code, results[0].name);
    } else {
      showResults(results, query);
    }
  } catch {
    const local = seed.filter(x =>
      x.name.toLowerCase().includes(query.toLowerCase()) ||
      x.code.startsWith(query)
    );

    if (local.length === 1) {
      load(local[0].code, local[0].name);
    } else {
      showResults(local, query, '검색 API 오류. 6자리 종목코드로 검색해 주세요.');
    }
  }
};

$('query').addEventListener('keydown', event => {
  if (event.key === 'Enter') $('searchBtn').click();
});

$('query').addEventListener('input', () => {
  const query = $('query').value.trim();

  $('clear').hidden = !query;
  clearTimeout(timer);

  if (!query) {
    $('results').hidden = true;
    return;
  }

  timer = setTimeout(async () => {
    try {
      showResults(await search(query), query);
    } catch {
      showResults(seed.filter(x =>
        x.name.toLowerCase().includes(query.toLowerCase()) ||
        x.code.startsWith(query)
      ), query);
    }
  }, 350);
});

$('clear').onclick = () => {
  $('query').value = '';
  $('results').hidden = true;
  $('clear').hidden = true;
};

$('theme').onclick = () => document.body.classList.toggle('dark');
$('refresh').onclick = () => load(current.code, current.name);

$('fav').onclick = () => {
  $('fav').textContent = $('fav').textContent === '☆' ? '★' : '☆';
};

$('quick').innerHTML = seed.slice(0, 8).map(item =>
  `<button data-code="${item.code}" data-name="${item.name}">${item.name}</button>`
).join('');

$('quick').querySelectorAll('button').forEach(button => {
  button.onclick = () => load(button.dataset.code, button.dataset.name);
});

load('005930', '삼성전자');
