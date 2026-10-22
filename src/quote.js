export const DRAFT_KEY = 'quote-builder:draft:v1';
export const MAX_ITEMS = 200;
export function isDraftEmpty(draft) {
  return ['provider','client','title','validUntil','comment'].every(key=>draft[key]==='')
    && draft.discount==='0'
    && draft.items.every(item=>item.name===''&&item.price===''&&item.quantity==='1');
}
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function decimalHundredths(value, message) {
  if (typeof value !== 'string' || value.length > 32 || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error(message);
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function safe(value) {
  if (value < 0n || value > MAX) throw new Error('Сумма слишком велика. Уменьшите цену или количество.');
  return Number(value);
}

export function parsePrice(value) {
  return safe(decimalHundredths(value, 'Введите цену от 0, не более двух знаков после запятой.'));
}

export function parseQuantity(value) {
  if (typeof value !== 'string' || value.length > 32 || !/^\d+$/.test(value.trim())) throw new Error('Количество — целое число от 1.');
  const quantity = BigInt(value.trim());
  if (quantity < 1n || quantity > MAX) throw new Error('Количество — безопасное целое число от 1.');
  return Number(quantity);
}

export function parseDiscount(value) {
  const discount = decimalHundredths(value, 'Введите скидку от 0 до 100%, не более двух знаков после запятой.');
  if (discount > 10000n) throw new Error('Скидка должна быть от 0 до 100%.');
  return Number(discount);
}

export function calculateQuote(items, discount) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new Error(`Допустимо до ${MAX_ITEMS} позиций.`);
  let subtotal = 0n;
  const lines = items.map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200) throw new Error('Укажите название каждой позиции (до 200 символов).');
    const quantity = parseQuantity(item.quantity);
    const priceCents = parsePrice(item.price);
    const lineCents = safe(BigInt(quantity) * BigInt(priceCents));
    subtotal += BigInt(lineCents);
    safe(subtotal);
    return {name:item.name.trim(), quantity, priceCents, lineCents};
  });
  const discountBps = parseDiscount(discount);
  // Exact half-up rounding, once on the aggregate. No floating point money.
  const discountCents = Number((subtotal * BigInt(discountBps) + 5000n) / 10000n);
  const subtotalCents = safe(subtotal);
  return {lines, subtotalCents, discountBps, discountCents, totalCents:subtotalCents - discountCents};
}

export function formatMoney(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Некорректная сумма.');
  const value = BigInt(cents);
  const rubles = (value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${rubles},${(value % 100n).toString().padStart(2, '0')}\u00a0₽`;
}

export function createEmptyDraft() {
  return {provider:'',client:'',title:'',validUntil:'',comment:'',discount:'0',items:[{name:'',quantity:'1',price:''}]};
}

export function createDemoDraft(today = new Date()) {
  const until = new Date(today.getFullYear(),today.getMonth(),today.getDate()+14);
  const validUntil = `${until.getFullYear()}-${String(until.getMonth()+1).padStart(2,'0')}-${String(until.getDate()).padStart(2,'0')}`;
  return {
    provider:'Студия «Форма»', client:'Кофейня «Тихий двор»',
    title:'Сайт для вашей кофейни', validUntil, discount:'10',
    comment:'Два этапа оплаты: 50% до начала работ и 50% после приёмки. Срок работы — 3 недели. Все названия и условия в этом примере вымышлены.',
    items:[
      {name:'Дизайн и сборка лендинга',quantity:'1',price:'48000'},
      {name:'Авторские иллюстрации',quantity:'2',price:'18000'},
      {name:'Настройка и передача проекта',quantity:'1',price:'6000'}
    ]
  };
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object' || !Array.isArray(draft.items) || draft.items.length > MAX_ITEMS) throw new Error('Некорректный черновик.');
  const limits = {provider:180,client:180,title:180,validUntil:10,comment:2000,discount:32};
  const copy = {};
  for (const [key,limit] of Object.entries(limits)) {
    if (typeof draft[key] !== 'string' || draft[key].length > limit) throw new Error('Некорректный формат поля.');
    copy[key] = draft[key];
  }
  copy.items = draft.items.map(item => {
    const row = {};
    for (const [key,limit] of Object.entries({name:200,quantity:32,price:32})) {
      if (!item || typeof item[key] !== 'string' || item[key].length > limit) throw new Error('Некорректная позиция.');
      row[key] = item[key];
    }
    return row;
  });
  return copy;
}

export function saveDraft(storage,draft) {
  try {
    storage.setItem(DRAFT_KEY,JSON.stringify({version:1,draft:normalizeDraft(draft)}));
    return {ok:true};
  } catch {
    return {ok:false,error:'Не удалось сохранить. Черновик доступен только до закрытия страницы.'};
  }
}

export function loadDraft(storage) {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (raw === null) return {draft:null,error:null};
    if (raw.length > 150000) throw new Error('Too large');
    const data = JSON.parse(raw);
    if (data.version !== 1) throw new Error('Version');
    return {draft:normalizeDraft(data.draft),error:null};
  } catch {
    return {draft:null,error:'Не удалось прочитать черновик. Можно продолжить в новом документе.'};
  }
}

export function clearDraft(storage) {
  try {
    storage.removeItem(DRAFT_KEY);
    return {ok:true};
  } catch {
    return {ok:false,error:'Не удалось удалить сохранённый черновик. После перезагрузки он может вернуться.'};
  }
}

export function validateDetails(draft) {
  const errors = {};
  for (const [key,label] of Object.entries({provider:'исполнителя',client:'клиента',title:'название предложения'})) {
    if (typeof draft[key] !== 'string' || !draft[key].trim()) errors[key] = `Укажите ${label}.`;
  }
  const date = typeof draft.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.validUntil) ? new Date(`${draft.validUntil}T12:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== draft.validUntil) errors.validUntil = 'Укажите существующую дату.';
  return errors;
}

// A partial draft is still a useful document preview. Invalid money is never
// substituted with zero, and this view model never changes the saved draft.
export function createDocumentModel(draft) {
  const detailsErrors=validateDetails(draft);
  let totals=null;
  if(draft.items.length){
    try { totals=calculateQuote(draft.items,draft.discount); } catch { /* unfinished input */ }
  }
  const lines=draft.items.map(item=>{
    let quantity=null,priceCents=null,lineCents=null;
    try { quantity=parseQuantity(item.quantity); } catch { /* unfinished input */ }
    try { priceCents=parsePrice(item.price); } catch { /* unfinished input */ }
    if(quantity!==null && priceCents!==null){
      try {lineCents=calculateQuote([{...item,name:item.name.trim()||'Позиция'}],'0').totalCents;} catch { /* overflow */ }
    }
    return {name:item.name.trim()||'Название работы',placeholder:!item.name.trim(),quantity,priceCents,lineCents};
  });
  return {
    title:draft.title.trim()||'Название предложения',
    provider:draft.provider.trim()||'Исполнитель',
    client:draft.client.trim()||'Клиент',
    validUntil:detailsErrors.validUntil?null:draft.validUntil.split('-').reverse().join('.'),
    comment:draft.comment.trim(),lines,totals,
    ready:!Object.keys(detailsErrors).length && totals!==null
  };
}

