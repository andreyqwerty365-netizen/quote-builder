import test from 'node:test';
import assert from 'node:assert/strict';
import {isDraftEmpty,createEmptyDraft,createDemoDraft} from '../src/quote.js';

test('QUOTE-01: пример недоступен при вводе любого реквизита',()=>{
  for(const key of ['provider','client','title','validUntil','comment']){
    assert.equal(isDraftEmpty({...createEmptyDraft(),[key]:'Мои данные'}),false,key);
  }
});
test('QUOTE-01: нулевая цена, количество, скидка и незавершённый ввод тоже защищены',()=>{
  for(const patch of [{name:'Работа'},{price:'0'},{quantity:'2'},{quantity:''},{price:'12,'},{name:' '}]){
    const draft=createEmptyDraft();Object.assign(draft.items[0],patch);
    assert.equal(isDraftEmpty(draft),false,JSON.stringify(patch));
  }
  assert.equal(isDraftEmpty({...createEmptyDraft(),discount:'5'}),false);
  assert.equal(isDraftEmpty({...createEmptyDraft(),comment:' '}),false);
});
test('пример доступен в новом документе и после удаления всех пустых строк',()=>{
  assert.equal(isDraftEmpty(createEmptyDraft()),true);
  assert.equal(isDraftEmpty({...createEmptyDraft(),items:[]}),true);
});
test('заполненный восстановленный черновик не становится пустым',()=>{
  const restored=JSON.parse(JSON.stringify(createDemoDraft()));
  assert.equal(isDraftEmpty(restored),false);
});
