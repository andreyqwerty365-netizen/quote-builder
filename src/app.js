import {MAX_ITEMS,parsePrice,parseQuantity,parseDiscount,calculateQuote,formatMoney,
  createEmptyDraft,createDemoDraft,saveDraft,loadDraft,clearDraft,validateDetails,createDocumentModel,isDraftEmpty} from './quote.js';

const $=id=>document.getElementById(id);
const fields=['provider','client','title','validUntil','comment','discount'];
let storage;
try {storage=window.localStorage;} catch {storage=null;}
const loaded=loadDraft(storage);
let draft=loaded.draft??createEmptyDraft();
let touched=new Set();
let printAttempted=false;
let activeView='edit';
const mobile=window.matchMedia('(max-width: 1000px)');

function el(tag,text,className) {
  const node=document.createElement(tag);
  if(text!==undefined) node.textContent=text;
  if(className) node.className=className;
  return node;
}

function applyView() {
  $('edit-view').hidden=mobile.matches&&activeView!=='edit';
  $('preview-view').hidden=mobile.matches&&activeView!=='preview';
  for(const view of ['edit','preview']){
    const selected=activeView===view;
    $(view+'-tab').setAttribute('aria-selected',String(selected));
    $(view+'-tab').tabIndex=selected?0:-1;
  }
}

function setView(view) {
  activeView=view;
  applyView();
}

for(const view of ['edit','preview']){
  $(view+'-tab').addEventListener('click',()=>setView(view));
  $(view+'-tab').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next=event.key==='Home'?'edit':event.key==='End'?'preview':activeView==='edit'?'preview':'edit';
    setView(next);
    $(next+'-tab').focus();
  });
}
mobile.addEventListener('change',applyView);
document.querySelector('.skip-link').addEventListener('click',()=>setView('edit'));

function storageMessage(message,warning=false) {
  $('storage-status').textContent=warning?'Ошибка хранения':message;
  $('storage-status').classList.toggle('warning',warning);
  $('storage-error').textContent=warning?message:'';
  $('storage-error').hidden=!warning;
}

function persist() {
  const result=saveDraft(storage,draft);
  storageMessage(result.ok?'Сохранено':result.error,!result.ok);
}

function renderRows() {
  const fragment=document.createDocumentFragment();
  draft.items.forEach((item,index)=>{
    const row=el('div',undefined,'item-row');
    row.dataset.index=index;
    const top=el('div',undefined,'item-top');
    top.append(el('span',String(index+1).padStart(2,'0'),'item-number'));

    function inputField(key,caption,className) {
      const field=el('div',undefined,className);
      const label=el('label',caption,key==='name'?'visually-hidden':undefined);
      const id='item-'+index+'-'+key;
      label.htmlFor=id;
      const input=el('input');
      input.id=id;
      input.dataset.field=key;
      input.value=item[key];
      input.maxLength=key==='name'?200:32;
      input.setAttribute('aria-label',caption+' позиции '+(index+1));
      input.setAttribute('aria-describedby','item-'+index+'-error');
      if(key!=='name') input.inputMode=key==='quantity'?'numeric':'decimal';
      if(key==='name') input.placeholder='Название работы или услуги';
      if(key==='price') input.placeholder='0,00';
      field.append(label,input);
      return field;
    }

    top.append(inputField('name','Название','item-name'));
    const remove=el('button',undefined,'delete-button');
    remove.type='button';
    remove.dataset.delete=index;
    remove.setAttribute('aria-label','Удалить позицию '+(index+1));
    const cross=el('span','×');
    cross.setAttribute('aria-hidden','true');
    remove.append(cross);
    top.append(remove);
    const bottom=el('div',undefined,'item-bottom');
    bottom.append(inputField('quantity','Количество','item-quantity'),inputField('price','Цена, ₽','item-price'));
    const amount=el('div',undefined,'item-amount');
    amount.append(el('span','Сумма','amount-label'));
    const output=el('output','—','row-money');
    output.id='item-'+index+'-amount';
    output.setAttribute('aria-label','Сумма позиции '+(index+1));
    amount.append(output);
    bottom.append(amount);
    const error=el('p','','row-errors');
    error.id='item-'+index+'-error';
    row.append(top,bottom,error);
    fragment.append(row);
  });
  $('items').replaceChildren(fragment);
  $('empty-items').hidden=draft.items.length>0;
  $('add-item').disabled=draft.items.length>=MAX_ITEMS;
}

function inspect() {
  const errors=validateDetails(draft);
  const rowErrors=draft.items.map((item,index)=>{
    const errors={};
    if(!item.name.trim()) errors.name='Укажите название.';
    for(const [key,parser] of [['quantity',parseQuantity],['price',parsePrice]]){
      try {parser(item[key]);} catch(error) {errors[key]=error.message;}
    }
    let amount=null;
    if(!Object.keys(errors).length){
      try {amount=calculateQuote([item],'0').totalCents;} catch(error) {
        // Either factor can cause a line overflow; report it for the field
        // the user just finished editing, including a restored draft.
        errors.price=error.message;
        errors.quantity=error.message;
      }
    }
    return {errors,amount,index};
  });
  try {parseDiscount(draft.discount);} catch(error) {errors.discount=error.message;}
  let result=null,calculationError='';
  try {result=calculateQuote(draft.items,draft.discount);} catch(error) {calculationError=error.message;}
  if(!draft.items.length) calculationError='Добавьте хотя бы одну позицию.';
  return {errors,rowErrors,result,calculationError,valid:!Object.keys(errors).length&&!calculationError};
}

function renderDocument() {
  const model=createDocumentModel(draft);
  const doc=$('print-document');
  doc.dataset.ready=String(model.ready);
  const content=el('div',undefined,'document-content');
  const masthead=el('div',undefined,'document-masthead');
  masthead.append(el('span',draft.provider.trim()||'ВАШЕ ИМЯ / СТУДИЯ','document-sender'),el('span','ПРЕДЛОЖЕНИЕ','document-kind'));
  content.append(masthead,el('h1',model.title,'document-title'+(!draft.title.trim()?' placeholder':'')));

  const parties=el('div',undefined,'document-parties');
  for(const [label,value,missing] of [
    ['Исполнитель',model.provider,!draft.provider.trim()],
    ['Клиент',model.client,!draft.client.trim()]
  ]){
    const party=el('div');
    party.append(el('span',label),el('strong',value,missing?'placeholder':undefined));
    parties.append(party);
  }
  content.append(parties,el('p',model.validUntil?'Действует до '+model.validUntil+' включительно':'Срок действия: укажите дату',
    'document-valid'+(!model.validUntil?' placeholder':'')));

  const table=el('table',undefined,'document-table');
  const head=el('thead');
  const header=el('tr');
  for(const label of ['Работы и услуги','Кол-во','Цена','Сумма']){
    const cell=el('th',label);
    cell.scope='col';
    header.append(cell);
  }
  head.append(header);
  const body=el('tbody');
  for(const line of model.lines){
    const row=el('tr');
    const name=el('td',line.name,line.placeholder?'placeholder':undefined);
    row.append(name,el('td',line.quantity===null?'—':String(line.quantity)));
    for(const value of [line.priceCents,line.lineCents]) row.append(el('td',value===null?'—':formatMoney(value)));
    body.append(row);
  }
  if(!model.lines.length){
    const row=el('tr');
    const cell=el('td','Добавьте работы или услуги','placeholder');
    cell.colSpan=4;
    row.append(cell);body.append(row);
  }
  table.append(head,body);
  content.append(table);

  const totals=el('div',undefined,'document-totals');
  const discount=model.totals?String(model.totals.discountBps/100).replace('.',','):'—';
  for(const [label,value,className] of [
    ['Стоимость работ',model.totals?.subtotalCents,''],
    ['Скидка '+discount+'%',model.totals?.discountCents,''],
    ['Итого к оплате',model.totals?.totalCents,'document-grand']
  ]){
    const line=el('p',undefined,className);
    line.append(el('span',label),el('strong',value===undefined?'—':formatMoney(value)));
    totals.append(line);
  }
  content.append(totals);
  if(model.comment){
    content.append(el('h2','Условия и комментарий','document-comment-heading'),el('p',model.comment,'document-comment'));
  }
  content.append(el('p','Все суммы указаны в рублях.','document-foot'));
  const warning=el('p','Предложение не готово к печати. Заполните обязательные поля и проверьте позиции.','print-warning');
  doc.replaceChildren(content,warning);
  $('document-status').textContent=model.ready?'Готово к печати':'Черновик';
  $('document-status').classList.toggle('ready',model.ready);
}

function update() {
  const state=inspect();
  $('current-title').textContent=draft.title.trim()||'Новое предложение';
  $('current-title').title=draft.title.trim()||'Новое предложение';
  $('empty-start').hidden=!isDraftEmpty(draft);
  const count=draft.items.length;
  const suffix=count%10===1&&count%100!==11?'позиция':count%10>=2&&count%10<=4&&!(count%100>=12&&count%100<=14)?'позиции':'позиций';
  $('item-count').textContent=count+' '+suffix;
  for(const key of ['provider','client','title','validUntil','discount']){
    const error=touched.has(key)&&state.errors[key];
    $(key).setAttribute('aria-invalid',error?'true':'false');
    $(key+'-error').textContent=error||'';
  }
  state.rowErrors.forEach(({index,errors,amount})=>{
    const messages=[];
    for(const key of ['name','quantity','price']){
      const error=touched.has('items.'+index+'.'+key)&&errors[key];
      $('item-'+index+'-'+key).setAttribute('aria-invalid',error?'true':'false');
      if(error) messages.push(error);
    }
    $('item-'+index+'-error').textContent=[...new Set(messages)].join(' ');
    $('item-'+index+'-amount').textContent=amount===null?'—':formatMoney(amount);
  });
  const calculated=state.result&&!state.calculationError;
  $('subtotal').textContent=calculated?formatMoney(state.result.subtotalCents):'—';
  $('discount-amount').textContent=calculated?'− '+formatMoney(state.result.discountCents):'—';
  $('total').textContent=calculated?formatMoney(state.result.totalCents):'—';
  $('total-note').textContent=calculated?'Все суммы в рублях':!count?'Добавьте первую позицию':
    state.rowErrors.some(row=>Object.keys(row.errors).length)?'Заполните позиции для расчёта':state.calculationError;
  $('validation-summary').hidden=!printAttempted||state.valid;
  if(printAttempted&&!state.valid){
    $('validation-summary').textContent=state.calculationError&&!state.rowErrors.some(row=>Object.keys(row.errors).length)?
      state.calculationError:'Проверьте отмеченные поля перед печатью.';
  }
  renderDocument();
  return state;
}

function render() {
  for(const key of fields) $(key).value=draft[key];
  renderRows();
  update();
}

$('editor').addEventListener('submit',event=>event.preventDefault());
$('editor').addEventListener('input',event=>{
  const input=event.target;
  if(input.dataset.field){
    const index=Number(input.closest('.item-row').dataset.index);
    draft.items[index][input.dataset.field]=input.value;
  } else if(fields.includes(input.id)) draft[input.id]=input.value;
  else return;
  persist();update();
});
$('editor').addEventListener('focusout',event=>{
  const input=event.target;
  if(input.dataset.field) touched.add('items.'+input.closest('.item-row').dataset.index+'.'+input.dataset.field);
  else touched.add(input.id);
  update();
});
$('add-item').addEventListener('click',()=>{
  if(draft.items.length>=MAX_ITEMS) return;
  draft.items.push({name:'',quantity:'1',price:''});
  renderRows();update();persist();
  $('item-'+(draft.items.length-1)+'-name').focus();
});
$('items').addEventListener('click',event=>{
  const button=event.target.closest('[data-delete]');
  if(!button) return;
  const index=Number(button.dataset.delete);
  draft.items.splice(index,1);
  touched=new Set([...touched].filter(key=>!key.startsWith('items.')));
  renderRows();update();persist();
  const next=$('item-'+Math.min(index,draft.items.length-1)+'-name');
  (next||$('add-item')).focus();
});
$('demo').addEventListener('click',()=>{
  if(!isDraftEmpty(draft)) return;
  draft=createDemoDraft();touched.clear();printAttempted=false;
  render();persist();
});

$('clear').addEventListener('click',()=>{
  if(isDraftEmpty(draft)) {newDocument();return;}
  $('clear-dialog').showModal();
  $('cancel-clear').focus();
});
$('cancel-clear').addEventListener('click',()=>$('clear-dialog').close());
function newDocument() {
  draft=createEmptyDraft();touched.clear();printAttempted=false;
  const cleared=clearDraft(storage);
  setView('edit');render();
  storageMessage(cleared.ok?'Новый черновик':cleared.error,!cleared.ok);
  $('clear-dialog').close();
  $('title').focus();
}
$('confirm-clear').addEventListener('click',newDocument);

$('print').addEventListener('click',()=>{
  printAttempted=true;
  fields.forEach(key=>touched.add(key));
  draft.items.forEach((item,index)=>['name','quantity','price'].forEach(key=>touched.add('items.'+index+'.'+key)));
  const state=update();
  if(!state.valid){
    setView('edit');
    const invalid=document.querySelector('[aria-invalid="true"]');
    (invalid||$('add-item')).focus();
    return;
  }
  window.print();
});
window.addEventListener('beforeprint',renderDocument);

render();
applyView();
storageMessage(loaded.error||(loaded.draft?'Черновик восстановлен':'Новый черновик'),!!loaded.error);

