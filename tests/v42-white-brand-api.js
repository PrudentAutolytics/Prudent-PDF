'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const check=(ok,m)=>{if(!ok){console.error('FAIL:',m);process.exitCode=1}else console.log('PASS:',m)};

const css=read('css/brand-light.css'),shell=read('js/shell.js'),cfg=JSON.parse(read('staticwebapp.config.json'));
check(css.includes('--page-bg    : #FFFFFF'),'white page background token is set');
check(!shell.includes('background:#07111f'),'top bar logo no longer sits in a dark box');
check(shell.includes('/assets/pa-logo-light.svg'),'top bar uses the light-surface logo');
check(shell.includes("href: '/developers'"),'API Access navigation item exists');
const appPages=fs.readdirSync(path.join(root,'pages')).filter(f=>f.endsWith('.html')).map(f=>'pages/'+f).filter(f=>read(f).includes('/css/main.css'));
check(appPages.every(f=>read(f).includes('/css/brand-light.css')),'every application page loads the white brand layer');
check(appPages.every(f=>read(f).indexOf('/css/brand-light.css')>read(f).lastIndexOf('</style>',read(f).indexOf('</head>'))),'white brand layer loads after page level styles');
const r=cfg.routes.find(x=>x.route==='/developers');
check(r&&r.rewrite==='/pages/developers.html','developers route rewrites to the API page');
check(r&&/noindex/.test(r.headers['X-Robots-Tag']),'developers page is not indexed');
check(read('robots.txt').includes('Disallow: /developers'),'robots.txt keeps developers private');
const api=read('pages/developers.html');
check(api.includes("Shell.init('api')"),'API page is protected by the authenticated shell');
check(api.includes('Coming soon'),'API page is clearly marked as coming soon');
check(!/[–—]/.test(api+css),'new sources contain no en dash or em dash');

// v43: public pricing and contact for signed-out visitors
const pricing=read('pages/pricing.html'),contact=read('pages/contact.html'),pub=read('js/public-shell.js');
check(!pricing.includes("location.replace('/login')"),'pricing no longer forces signed-out visitors to login');
check(!contact.includes("location.replace('/login')"),'contact no longer forces signed-out visitors to login');
check(pricing.includes('PublicShell.init') && contact.includes('PublicShell.init'),'pricing and contact use the public header when signed out');
check(pricing.includes("Shell.init('pricing')") && contact.includes("Shell.init('contact')"),'signed-in users keep the app shell');
check(/index, follow/.test(pricing) && /index, follow/.test(contact),'pricing and contact are indexable');
check(read('sitemap.xml').includes('/pricing') && read('sitemap.xml').includes('/contact'),'sitemap lists pricing and contact');
check(!/[\u2013\u2014]/.test(pub),'public shell has no en dash or em dash');

// v45: before/after compare, pricing sliders and accessibility
const home45=read('index.html'),price45=read('pages/pricing.html');
check(home45.includes('id="baRange"') && home45.includes('type="range"'),'homepage has a keyboard accessible before/after compare slider');
check(home45.includes('aria-valuetext') && home45.includes('data-ba="0"') && home45.includes('data-ba="100"'),'compare slider announces its position and has button alternatives');
check(home45.includes('class="skip-link"') && home45.includes('<main id="main">'),'homepage has a skip link to the main content');
check(price45.includes("rangeField('calcDocs'") && price45.includes('aria-live="polite"'),'pricing estimate uses sliders with a live result');
check(price45.includes('is-recommended'),'pricing highlights the best fit plan');
check(!/[–—]/.test(home45+price45),'updated pages contain no en dash or em dash');
