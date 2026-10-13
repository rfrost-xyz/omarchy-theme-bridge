import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Browser } from './browser.mjs';

const C = createRequire(import.meta.url)('../../extension/content/colour.js');
const DARK = {name:'night',mode:'dark',colors:{background:'#1a1b26',foreground:'#a9b1d6',accent:'#7aa2f7'}};
const LIGHT = {name:'day',mode:'light',colors:{background:'#eff1f5',foreground:'#4c4f69',accent:'#1e66f5'}};
const css = (hex) => `rgb(${C.triplet(hex)})`;
const active = "document.documentElement.getAttribute('data-omarchy-adapters') === 'x'";
let browser, options;
before(async()=>{browser=await Browser.launch();options=await browser.options();});
after(()=>browser?.close());
beforeEach(()=>options.eval("chrome.storage.local.set({disabledAdapters:[]})"));
const palette=(p)=>options.eval(`chrome.storage.local.set({palette:${JSON.stringify(p)}})`);
const toggle=()=>options.eval("[...document.querySelectorAll('#adapters label')].find(l=>l.textContent.trim()==='X').querySelector('input').click()");
const native=(mode)=>browser.open(`https://x.com/?client=native&mode=${mode}`);

for(const p of [LIGHT,DARK]) {
  test(`X native ${p.mode}: fixed page, cards, text and inline colours follow the palette and restore`,async()=>{
    await palette(p);const page=await native(p.mode);await page.waitFor(active);
    const d=C.derive(p);
    await page.waitFor(`getComputedStyle(document.querySelector('#timeline')).backgroundColor === '${css(p.colors.background)}'`);
    for(const s of ['body','#timeline','#inline']) {
      assert.equal(await page.style(s,'backgroundColor'),css(p.colors.background));
      assert.equal(await page.style(s,'color'),css(d.text));
    }
    assert.equal(await page.style('#sidebar','backgroundColor'),css(d.ramp[4]));
    assert.equal(await page.style('#secondary','color'),css(d['text-secondary']));
    assert.equal(await page.style('#sidebar-secondary','color'),css(d['text-secondary']));
    assert.equal(await page.style('#important','color'),css(d['text-secondary']));
    assert.equal(await page.style('#sticky','backgroundColor'),`rgba(${C.triplet(p.colors.background)}, 0.85)`);
    assert.equal(await page.style('#opposite','backgroundColor'),p.mode==='dark'?'rgb(255, 255, 255)':'rgb(0, 0, 0)');
    const nativeBody=await page.eval('document.body.style.backgroundColor');
    assert.equal(nativeBody,p.mode==='dark'?'rgb(0, 0, 0)':'rgb(255, 255, 255)');
    const protectedIds=['#brand','#engagement','#status','#badge','#inverted','#media','#image','#graphic','#inherited-graphic','#authored'];
    const snapshot=()=>page.eval(`Object.fromEntries(${JSON.stringify(protectedIds)}.map(s=>{const c=getComputedStyle(document.querySelector(s));return [s,[c.color,c.backgroundColor,c.backgroundImage,c.filter,c.opacity]];}))`);
    const protectedColours=await snapshot();
    await toggle();await page.waitFor(`!(${active})`);
    await page.waitFor(`getComputedStyle(document.querySelector('#timeline')).backgroundColor === '${nativeBody}'`);
    assert.deepEqual(await snapshot(),protectedColours);
    assert.equal(await page.style('body','backgroundColor'),nativeBody);
    assert.equal(await page.eval("document.querySelector('#inline').style.getPropertyValue('background-color')"),nativeBody);
    assert.equal(await page.eval(`[...document.querySelector('#react-native-stylesheet').sheet.cssRules].find(r=>r.selectorText==='.neutral-important-${p.mode}').style.getPropertyPriority('color')`),'important');
    await toggle();await page.waitFor(active);await page.close();
  });
}

test('X native: protected colours retain hover, focus, responsive and animated cascades',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await page.eval(`const s=document.querySelector('#react-native-stylesheet').sheet;
    for(const r of ['.interactive {color:rgb(83,100,113)}','.interactive:hover {color:rgb(130,154,171)}','.interactive:focus {color:rgb(29,155,240)}','@media (max-width:700px) {.interactive {color:rgb(15,20,25)}}','@keyframes authored-colour {from {color:rgb(83,100,113)} to {color:rgb(249,24,128)}}','.animated {animation:authored-colour 1ms forwards}','.explicit-inheritance {color:inherit}']) s.insertRule(r,s.cssRules.length);
    const g=document.querySelector('#graphic');g.removeAttribute('style');g.setAttribute('class','interactive');g.setAttribute('tabindex','0');g.querySelector('circle').setAttribute('fill','currentColor');
    document.querySelector('#inherited-graphic').setAttribute('class','explicit-inheritance');
    const nested=document.createElementNS('http://www.w3.org/2000/svg','svg');nested.id='nested-graphic';nested.setAttribute('class','explicit-inheritance');nested.innerHTML='<circle fill="currentColor" cx="20" cy="20" r="10"/>';g.append(nested);`);
  await page.waitFor("getComputedStyle(document.querySelector('#graphic')).color==='rgb(83, 100, 113)'",3000);
  await page.waitFor("getComputedStyle(document.querySelector('#inherited-graphic circle')).fill==='rgb(15, 20, 25)'",3000);
  await browser.send('DOM.enable',{},page.sessionId);await browser.send('CSS.enable',{},page.sessionId);
  const {root}=await browser.send('DOM.getDocument',{},page.sessionId);
  const {nodeId}=await browser.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#graphic'},page.sessionId);
  const check=async(expected)=>{
    for(const s of ['#graphic','#graphic circle','#nested-graphic circle']) {
      await page.waitFor(`getComputedStyle(document.querySelector('${s}')).${s.includes('circle')?'fill':'color'}==='${expected}'`,3000);
    }
    const themed=await page.style('#graphic','color');await toggle();await page.waitFor(`!(${active})`);
    assert.equal(await page.style('#graphic','color'),themed);await toggle();await page.waitFor(active);
  };
  await browser.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['hover']},page.sessionId);await check('rgb(130, 154, 171)');
  await browser.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['focus']},page.sessionId);await check('rgb(29, 155, 240)');
  await browser.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:[]},page.sessionId);
  await browser.send('Emulation.setDeviceMetricsOverride',{width:600,height:800,deviceScaleFactor:1,mobile:false},page.sessionId);await check('rgb(15, 20, 25)');
  await page.eval("document.querySelector('#graphic').setAttribute('class','interactive animated')");await check('rgb(249, 24, 128)');
  await page.close();
});

test('X native: private cascade properties restore prior values and priorities and retain later edits',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await toggle();await page.waitFor(`!(${active})`);
  await page.eval("document.querySelector('#inline').style.setProperty('--omarchy-x-native-original-color','rgb(12,34,56)','important');const s=document.querySelector('#react-native-stylesheet').sheet;[...s.cssRules].find(r=>r.selectorText==='.neutral-important-light').style.setProperty('--omarchy-x-native-original-color','rgb(56,34,12)')");
  await toggle();await page.waitFor(active);await page.waitFor("document.querySelector('#inline').style.color.includes('var(')");
  await toggle();await page.waitFor(`!(${active})`);
  assert.equal(await page.eval("document.querySelector('#inline').style.getPropertyValue('--omarchy-x-native-original-color')"),'rgb(12,34,56)');
  assert.equal(await page.eval("document.querySelector('#inline').style.getPropertyPriority('--omarchy-x-native-original-color')"),'important');
  assert.equal(await page.eval("[...document.querySelector('#react-native-stylesheet').sheet.cssRules].find(r=>r.selectorText==='.neutral-important-light').style.getPropertyPriority('--omarchy-x-native-original-color')"),'');
  await toggle();await page.waitFor(active);await page.eval("document.querySelector('#inline').style.setProperty('--omarchy-x-native-original-color','rgb(98,76,54)','important')");
  await toggle();await page.waitFor(`!(${active})`);
  assert.equal(await page.eval("document.querySelector('#inline').style.getPropertyValue('--omarchy-x-native-original-color')"),'rgb(98,76,54)');
  await toggle();await page.waitFor(active);await page.close();
});

test('X native: SVG inherited from an animated ancestor retains intermediate and final native colours',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await page.eval(`const s=document.querySelector('#react-native-stylesheet').sheet;
    s.insertRule('@keyframes parent-colour {from {color:rgb(83,100,113)} to {color:rgb(249,24,128)}}',s.cssRules.length);
    s.insertRule('.animated-parent {color:rgb(83,100,113);animation:parent-colour 1000ms linear forwards}',s.cssRules.length);
    const e=document.createElement('div');e.id='animated-parent';e.className='animated-parent';e.innerHTML='<svg id="animated-child"><circle fill="currentColor" cx="20" cy="20" r="10"/></svg>';document.body.append(e);`);
  await page.waitFor("[...document.querySelector('#react-native-stylesheet').sheet.cssRules].find(r=>r.name==='parent-colour').cssRules[0].style.getPropertyValue('--omarchy-x-native-original-color')",3000);
  for(const time of [0,250,500,1000]) {
    await page.eval(`document.querySelector('#animated-parent').getAnimations().forEach(a=>{a.pause();a.currentTime=${time}})`);
    const expected=await page.style('#animated-parent','color');
    await page.waitFor(`getComputedStyle(document.querySelector('#animated-child circle')).fill==='${expected}'`,3000);
    await toggle();await page.waitFor(`!(${active})`);
    assert.equal(await page.style('#animated-child circle','fill'),expected);await toggle();await page.waitFor(active);
    await page.waitFor("[...document.querySelector('#react-native-stylesheet').sheet.cssRules].find(r=>r.name==='parent-colour').cssRules[0].style.getPropertyValue('--omarchy-x-native-original-color')",3000);
  }
  await page.close();
});

test('X native: inherited SVG colour transitions retain native timing and restore transition declarations',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await page.eval(`const s=document.querySelector('#react-native-stylesheet').sheet;
    for(const r of ['.transition-parent {color:rgb(83,100,113);transition:opacity 2s ease-in 50ms,color 1s linear 100ms}','.transition-parent.changed {color:rgb(249,24,128)}','.transition-all {color:rgb(83,100,113);transition:all 1s linear}','.transition-all.changed {color:rgb(249,24,128)}']) s.insertRule(r,s.cssRules.length);
    for(const kind of ['transition-parent','transition-all']) {const e=document.createElement('div');e.id=kind;e.className=kind;e.innerHTML='<svg><circle fill="currentColor" cx="20" cy="20" r="10"/></svg>';document.body.append(e);const ref=document.createElement('div');ref.id=kind+'-reference';ref.className=kind;ref.dataset.testid='tweetPhoto';document.body.append(ref);}`);
  await page.waitFor("[...document.querySelector('#react-native-stylesheet').sheet.cssRules].find(r=>r.selectorText==='.transition-parent').style.transitionProperty.includes('--omarchy-x-native-original-color')",3000);
  await page.waitFor("['transition-parent','transition-all'].every(id=>getComputedStyle(document.getElementById(id)).getPropertyValue('--omarchy-x-native-original-color').trim()==='rgb(83, 100, 113)')",4000);
  await page.eval("['transition-parent','transition-all'].forEach(id=>[id,id+'-reference'].forEach(node=>document.getElementById(node).classList.add('changed')))");
  for(const id of ['transition-parent','transition-all']) {
    await page.waitFor(`document.getElementById('${id}').getAnimations().some(a=>a.transitionProperty==='color')`);
    await page.eval(`['${id}','${id}-reference'].forEach(node=>document.getElementById(node).getAnimations().forEach(a=>{a.pause();a.currentTime=600}))`);
    const native=await page.eval(`document.getElementById('${id}').getAnimations().find(a=>a.transitionProperty==='color').effect.getKeyframes()`);
    assert.ok(native.length>=2);
    // Parent starts from a mapped neutral. The protected SVG starts from
    // native grey and must follow the original native timing towards pink.
    const expected=await page.style(`#${id}-reference`,'color');
    assert.equal(await page.style(`#${id} circle`,'fill'),expected,JSON.stringify(await page.eval(`document.getElementById('${id}').getAnimations().map(a=>({property:a.transitionProperty,time:a.currentTime,frames:a.effect.getKeyframes(),timing:a.effect.getTiming()}))`)));
  }
  await toggle();await page.waitFor(`!(${active})`);
  assert.equal(await page.eval("[...document.querySelector('#react-native-stylesheet').sheet.cssRules].find(r=>r.selectorText==='.transition-parent').style.transition"),'opacity 2s ease-in 50ms, color 1s linear 100ms');
  assert.equal(await page.eval("[...document.querySelector('#react-native-stylesheet').sheet.cssRules].find(r=>r.selectorText==='.transition-all').style.transition"),'1s linear');
  await toggle();await page.waitFor(active);await page.close();
});

test('X native: unrecognised body foreground stays app-owned while neutral surfaces follow the palette',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await page.eval("document.body.style.color='rgb(249,24,128)'");
  await page.waitFor("getComputedStyle(document.body).color==='rgb(249, 24, 128)'",3000);
  assert.equal(await page.style('#timeline','color'),css(C.derive(LIGHT).text));
  assert.equal(await page.style('#timeline','backgroundColor'),css(LIGHT.colors.background));
  await toggle();await page.waitFor(`!(${active})`);assert.equal(await page.style('body','color'),'rgb(249, 24, 128)');
  await toggle();await page.waitFor(active);await page.close();
});

test('X native: dynamically inserted CSSOM rules and inline declarations are translated without selector knowledge',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await page.eval("const s=document.getElementById('react-native-stylesheet').sheet;s.insertRule('.invented-runtime-class {background-color:rgb(255,255,255);color:rgb(83,100,113)}',s.cssRules.length);const e=document.createElement('div');e.id='new-native';e.className='invented-runtime-class';e.textContent='Synthetic card';document.body.append(e)");
  await page.waitFor(`getComputedStyle(document.querySelector('#new-native')).backgroundColor==='${css(LIGHT.colors.background)}'`,3000);
  assert.equal(await page.style('#new-native','color'),css(C.derive(LIGHT)['text-secondary']));
  await page.eval("document.querySelector('#inline').style.color='rgb(83,100,113)'");
  await page.waitFor(`getComputedStyle(document.querySelector('#inline')).color==='${css(C.derive(LIGHT)['text-secondary'])}'`,3000);
  await palette({...LIGHT,colors:{...LIGHT.colors,background:'#dfe4c4'}});
  await page.waitFor("getComputedStyle(document.querySelector('#new-native')).backgroundColor==='rgb(223, 228, 196)'");
  await page.close();
});

test('X native: untouched body mode wins over stale root marker, and mismatch and unknown modes restore',async()=>{
  await palette(DARK);const page=await native('dark');await page.waitFor(active);
  assert.equal(await page.eval("document.documentElement.dataset.theme"),'light');
  await page.eval("setNativeMode('light')");await page.waitFor(`!(${active})`,4000);
  assert.equal(await page.style('#timeline','backgroundColor'),'rgb(255, 255, 255)');
  await palette(LIGHT);await page.waitFor(active);
  await page.eval("setNativeMode('none')");await page.waitFor(`!(${active})`,4000);
  await options.waitFor("[...document.querySelectorAll('#adapters li')].some(l=>l.textContent.includes('X')&&l.textContent.includes('Waiting for the app to load'))");
  await page.eval("setNativeMode('light')");await page.waitFor(active);await page.close();
});

test('X native: later app edits and declaration priorities survive disable',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await page.waitFor("document.querySelector('#inline').style.color.includes('var(')");
  await page.eval("document.querySelector('#inline').style.setProperty('color','rgb(249,24,128)','important')");
  await toggle();await page.waitFor(`!(${active})`);
  assert.equal(await page.style('#inline','color'),'rgb(249, 24, 128)');
  assert.equal(await page.eval("document.querySelector('#inline').style.getPropertyPriority('color')"),'important');
  await toggle();await page.waitFor(active);await page.close();
});

test('X native: changing one border side preserves it and restores the remaining sides',async()=>{
  await palette(LIGHT);const page=await native('light');await page.waitFor(active);
  await page.waitFor("document.querySelector('#inline').style.borderRightColor.includes('var(')");
  await page.eval("document.querySelector('#inline').style.borderTopColor='rgb(249,24,128)'");
  await toggle();await page.waitFor(`!(${active})`);
  assert.equal(await page.style('#inline','borderTopColor'),'rgb(249, 24, 128)');
  for(const side of ['Right','Bottom','Left']) {
    assert.equal(await page.style('#inline',`border${side}Color`),'rgb(207, 217, 222)');
    assert.equal(await page.eval(`document.querySelector('#inline').style.border${side}Color`),'rgb(207, 217, 222)');
  }
  await toggle();await page.waitFor(active);await page.close();
});

for(const p of [LIGHT,DARK]) {
  test(`X native ${p.mode}: protected media and SVG keep native colours from shared and inherited stylesheet declarations`,async()=>{
    await palette(p);const page=await native(p.mode);await page.waitFor(active);
    await page.eval(`document.querySelector('#media').removeAttribute('style');document.querySelector('#media').className='page-${p.mode}';document.querySelector('#graphic').removeAttribute('style');document.querySelector('#graphic').setAttribute('class','secondary-${p.mode}');document.querySelector('#graphic circle').setAttribute('fill','currentColor')`);
    const nativeBg=p.mode==='light'?'rgb(255, 255, 255)':'rgb(0, 0, 0)';
    const nativeText=p.mode==='light'?'rgb(15, 20, 25)':'rgb(231, 233, 234)';
    const nativeSecondary=p.mode==='light'?'rgb(83, 100, 113)':'rgb(113, 118, 123)';
    await page.waitFor(`getComputedStyle(document.querySelector('#media')).backgroundColor==='${nativeBg}' && getComputedStyle(document.querySelector('#graphic')).color==='${nativeSecondary}'`,3000);
    assert.equal(await page.style('#timeline','backgroundColor'),css(p.colors.background));
    assert.equal(await page.style('#media','color'),nativeText);
    assert.equal(await page.style('#graphic circle','fill'),nativeSecondary);
    assert.equal(await page.style('#inherited-graphic circle','fill'),nativeText);
    const protectedStyles=()=>page.eval("['#media','#graphic','#inherited-graphic'].map(s=>{const c=getComputedStyle(document.querySelector(s));return [c.color,c.backgroundColor]})");
    const themed=await protectedStyles();await toggle();await page.waitFor(`!(${active})`);
    assert.deepEqual(await protectedStyles(),themed);
    await toggle();await page.waitFor(active);
    await page.eval("document.querySelector('#graphic').setAttribute('class','blue')");
    await page.waitFor("getComputedStyle(document.querySelector('#graphic')).color==='rgb(29, 155, 240)'",3000);
    await page.eval("document.querySelector('#media').style.setProperty('color','rgb(249,24,128)','important')");
    await toggle();await page.waitFor(`!(${active})`);
    assert.equal(await page.style('#media','color'),'rgb(249, 24, 128)');
    assert.equal(await page.eval("document.querySelector('#media').style.getPropertyPriority('color')"),'important');
    assert.equal(await page.style('#graphic','color'),'rgb(29, 155, 240)');
    await toggle();await page.waitFor(active);await page.close();
  });
}
