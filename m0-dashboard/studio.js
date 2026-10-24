'use strict';
function refreshStudio(){
  $('studio-target-name').textContent=$('target-name').value.trim()||'选择靶标';
  $('studio-generate').disabled=$('generate').disabled;
  $('studio-generate').textContent=$('generate').textContent.includes('正在')?'计算中…':result?'重新生成':'生成探针';
  document.body.classList.toggle('has-result',Boolean(result));
}
function showStudioDialog(id){
  closeModuleEditor(false);
  for(const dialog of document.querySelectorAll('.studio-dialog[open]'))dialog.close();
  if(id==='conditions-dialog')$('condition-settings').open=true;
  $(id).showModal();
}
$('studio-target').addEventListener('click',()=>showStudioDialog('target-dialog'));
$('studio-conditions').addEventListener('click',()=>showStudioDialog('conditions-dialog'));
$('studio-modules').addEventListener('click',()=>openModuleEditor('primer',$('module-context').value));
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>{$(b.dataset.close).close();refreshStudio();});
$('design-form').addEventListener('input',()=>queueMicrotask(refreshStudio));
$('design-form').addEventListener('click',()=>queueMicrotask(refreshStudio));
$('design-form').addEventListener('invalid',event=>{
  const dialog=event.target.closest('dialog');if(dialog&&!dialog.open)dialog.showModal();
},true);
$('design-form').addEventListener('submit',()=>{
  for(const dialog of document.querySelectorAll('.studio-dialog[open]'))dialog.close();
  queueMicrotask(refreshStudio);
});
new MutationObserver(refreshStudio).observe($('generate'),{attributes:true,childList:true,subtree:true});
// Keep historical pages accessible without filling the main canvas with navigation.
const oldNav=document.querySelector('.layout>aside'),menu=node('details',undefined,'project-menu');menu.append(node('summary','项目'));
const links=node('div');for(const a of [...oldNav.querySelectorAll('a.nav')])links.append(a);menu.append(links);document.querySelector('header').append(menu);oldNav.remove();
$('design-output').before($('status'));
$('status').classList.add('studio-status');
document.querySelector('footer').append($('service'));
refreshStudio();
// Render an actual calculation for the restored valid draft; otherwise ask for a target.
if(mutation.ready&&workflowSupported())$('design-form').requestSubmit();else showStudioDialog('target-dialog');

$('language-switch')?.addEventListener('click',()=>{saveDraft();try{localStorage.setItem('padlock-language',location.pathname.endsWith('design-en.html')?'zh':'en');}catch{}});
