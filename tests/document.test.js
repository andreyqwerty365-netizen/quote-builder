import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentModel} from '../src/quote.js';
import {createEmptyDraft,createDemoDraft} from '../src/quote.js';

test('предпросмотр полного документа содержит стороны, услуги, условия и точный итог',()=>{
  const draft=createDemoDraft(new Date(2026,9,22));
  const model=createDocumentModel(draft);
  assert.ok(model);
  assert.equal(model.ready,true);
  assert.equal(model.title,draft.title);
  assert.equal(model.provider,draft.provider);
  assert.equal(model.client,draft.client);
  assert.equal(model.validUntil,'05.11.2026');
  assert.equal(model.lines.length,3);
  assert.equal(model.lines[1].lineCents,3600000);
  assert.equal(model.totals.totalCents,8100000);
  assert.equal(model.comment,draft.comment);
});

test('пустой черновик показывает структуру документа и не выдумывает суммы',()=>{
  const model=createDocumentModel(createEmptyDraft());
  assert.ok(model);
  assert.equal(model.ready,false);
  assert.equal(model.title,'Название предложения');
  assert.equal(model.provider,'Исполнитель');
  assert.equal(model.client,'Клиент');
  assert.equal(model.validUntil,null);
  assert.equal(model.lines[0].name,'Название работы');
  assert.equal(model.lines[0].lineCents,null);
  assert.equal(model.totals,null);
});

test('неполные реквизиты не прячут валидные расчёты в предпросмотре',()=>{
  const draft={...createDemoDraft(),client:''};
  const model=createDocumentModel(draft);
  assert.ok(model);
  assert.equal(model.ready,false);
  assert.equal(model.totals.totalCents,8100000);
});

test('невалидная цена и переполнение не попадают в предпросмотр как числа',()=>{
  for(const [price,quantity] of [['1,','1'],['90071992547409.91','2']]){
    const draft={...createDemoDraft(),items:[{name:'Работа',price,quantity}]};
    const model=createDocumentModel(draft);
    assert.ok(model);
    assert.equal(model.ready,false);
    assert.equal(model.totals,null);
    assert.equal(model.lines[0].lineCents,null);
  }
});

test('предпросмотр не меняет черновик и сохраняет пользовательский текст',()=>{
  const draft={...createDemoDraft(),title:'<b>Название</b>',comment:'<img src=x>\nУсловия'};
  const before=structuredClone(draft);
  const model=createDocumentModel(draft);
  assert.ok(model);
  assert.equal(model.title,'<b>Название</b>');
  assert.equal(model.comment,draft.comment);
  assert.deepEqual(draft,before);
});

test('смета без позиций не становится готовым документом с нулевым итогом',()=>{
  const model=createDocumentModel({...createDemoDraft(),items:[]});
  assert.ok(model);
  assert.equal(model.ready,false);
  assert.equal(model.totals,null);
  assert.deepEqual(model.lines,[]);
});
