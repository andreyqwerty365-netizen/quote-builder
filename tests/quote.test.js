import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrice, parseQuantity, parseDiscount, calculateQuote, formatMoney,
  createEmptyDraft, createDemoDraft, saveDraft, loadDraft, clearDraft, validateDetails, DRAFT_KEY} from '../src/quote.js';

const item = (price = '10,05', quantity = '3') => ({name: 'Дизайн', price, quantity});
const memory = () => {
  const entries = new Map();
  return {getItem: key => entries.get(key) ?? null, setItem: (key,value) => entries.set(key,value), removeItem: key => entries.delete(key)};
};

test('цена с точкой и запятой преобразуется в целые копейки', () => {
  assert.equal(parsePrice(' 12,34 '), 1234);
  assert.equal(parsePrice('12.3'), 1230);
  assert.equal(parsePrice('0.01'), 1);
  assert.equal(parsePrice('0'), 0);
});
test('цена отклоняет пустоту, отрицательные числа, лишнюю точность и экспоненту', () => {
  for (const value of ['', ' ', '-1', '1.005', '1e3', 'NaN', 'Infinity', '1,2.3', '1 000', null, 1]) assert.throws(() => parsePrice(value));
});
test('граница безопасного целого проверяется до преобразования', () => {
  assert.equal(parsePrice('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  assert.throws(() => parsePrice('90071992547409.92'));
  assert.throws(() => parsePrice('999999999999999999999999'));
});
test('количество — безопасное целое от единицы', () => {
  assert.equal(parseQuantity(' 2 '), 2);
  for (const value of ['0', '-1', '1.2', '1e2', '', '9007199254740992', null]) assert.throws(() => parseQuantity(value));
});
test('скидка допускает 0–100 процентов и две десятичные цифры', () => {
  assert.equal(parseDiscount('12,50'), 1250);
  assert.equal(parseDiscount('100'), 10000);
  for (const value of ['', '-1', '100.01', '10.001', 'abc']) assert.throws(() => parseDiscount(value));
});
test('дробные цены суммируются без ошибки двоичной арифметики', () => {
  const result = calculateQuote([item('0.10', '3'), item('0,20', '1')], '0');
  assert.equal(result.subtotalCents, 50);
  assert.equal(result.totalCents, 50);
  assert.equal(result.lines[0].lineCents, 30);
});
test('скидка округляется один раз от общей суммы, половина копейки вверх', () => {
  assert.equal(calculateQuote([item('0.01', '1')], '50').discountCents, 1);
  const result = calculateQuote([item('10.05', '3')], '12.5');
  assert.equal(result.subtotalCents, 3015);
  assert.equal(result.discountCents, 377);
  assert.equal(result.totalCents, 2638);
});
test('нулевая и полная скидка, бесплатные позиции и пустая смета', () => {
  assert.equal(calculateQuote([item()], '0').totalCents, 3015);
  assert.equal(calculateQuote([item()], '100').totalCents, 0);
  assert.equal(calculateQuote([item('0')], '15').totalCents, 0);
  assert.equal(calculateQuote([], '0').totalCents, 0);
});
test('плохие строки и переполнение строки/итога отклоняются', () => {
  for (const items of [[{...item(),name:' '}], [item('1','0')], [item('90071992547409.91','2')], [item('90071992547409.91','1'),item('0.01','1')]]) assert.throws(() => calculateQuote(items, '0'));
});
test('формат рублей сохраняет копейки даже у безопасного предела', () => {
  assert.equal(formatMoney(123456), '1\u00a0234,56\u00a0₽');
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER), '90\u00a0071\u00a0992\u00a0547\u00a0409,91\u00a0₽');
});
test('пустой черновик независим, демосмета синтетическая и рассчитана', () => {
  const empty = createEmptyDraft();
  empty.items[0].name = 'Изменено';
  assert.equal(createEmptyDraft().items[0].name, '');
  const demo = createDemoDraft(new Date(2026, 9, 22));
  assert.equal(demo.validUntil, '2026-11-05');
  assert.equal(demo.items.length, 3);
  assert.equal(calculateQuote(demo.items,demo.discount).totalCents, 8100000);
});
test('черновик сохраняет все поля и даже промежуточные невалидные строки', () => {
  const storage = memory();
  const draft = {...createDemoDraft(), comment:'<script>текст</script>', items:[item('12,','')]};
  assert.deepEqual(saveDraft(storage,draft), {ok:true});
  assert.deepEqual(loadDraft(storage), {draft,error:null});
  assert.notEqual(loadDraft(storage).draft, draft);
  assert.deepEqual(clearDraft(storage), {ok:true});
  assert.deepEqual(loadDraft(storage), {draft:null,error:null});
});
test('недоступное хранилище обрабатывается без исключения', () => {
  const unavailable = {getItem(){throw Error('blocked')},setItem(){throw Error('quota')},removeItem(){throw Error('blocked')}};
  assert.equal(saveDraft(unavailable,createEmptyDraft()).ok, false);
  assert.equal(clearDraft(unavailable).ok, false);
  assert.equal(loadDraft(unavailable).draft, null);
  assert.ok(loadDraft(unavailable).error);
  assert.equal(loadDraft(null).draft,null);
});
test('поврежденный или чужой формат не загружается и не перезаписывается', () => {
  const storage = memory();
  for (const raw of ['{', JSON.stringify({version:2,draft:createEmptyDraft()}), JSON.stringify({version:1,draft:{items:[]}})]) {
    storage.setItem(DRAFT_KEY,raw);
    assert.equal(loadDraft(storage).draft,null);
    assert.ok(loadDraft(storage).error);
    assert.equal(storage.getItem(DRAFT_KEY),raw);
  }
});
test('проверка реквизитов требует стороны, заголовок и настоящую дату', () => {
  assert.deepEqual(validateDetails(createDemoDraft()),{});
  const errors=validateDetails({...createEmptyDraft(),validUntil:'2026-02-30'});
  assert.ok(errors.provider && errors.client && errors.title && errors.validUntil);
  assert.ok(validateDetails({...createDemoDraft(),validUntil:''}).validUntil);
});
