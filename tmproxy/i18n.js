/* RU/EN UI; browser locale by default, an explicit choice is stored by the background. */
(function(root){
  const messages={
    'Быстрый режим: соединение 1,2 с, ответ сайта 3 с.':'Fast mode: 1.2 s for connection, 3 s for the website response.',
    'Список прокси · TXT / JSON':'Proxy list · TXT / JSON',
    'Геолокация IP · country.is':'IP geolocation · country.is',
    'Некорректный JSON-список.':'Invalid JSON proxy list.',
    'Настройки':'Settings',
    'Очистить':'Clear',
    'Оставьте поле сайта пустым, чтобы проверять только соединение.':'Leave the website empty to check connections only.',
    'Проверено {done} / {total} · рабочие: {working}':'Checked {done} / {total} · working: {working}',
    'Автопереключение при отказе прокси':'Automatically switch when a proxy fails',
    'Активный прокси: {proxy}':'Active proxy: {proxy}',
    'Проверяем подключение…':'Checking the connection…',
    'Подключение работает.':'Connection is working.',
    'Прокси автоматически заменён.':'Proxy switched automatically.',
    'Рабочая замена не найдена. Повторная проверка через минуту.':'No working replacement found. Checking again in a minute.',
    'Не удалось проверить подключение.':'Could not check the connection.',
    'Поиск и проверка прокси в браузере':'Find and check proxies in your browser',
    'Выключен':'Off','Прокси включён':'Proxy on','Проверка':'Check proxies','Сохранённые источники':'Saved sources',
    'Выберите источник…':'Choose a source…','Протокол строк без схемы':'Protocol for addresses without a scheme',
    'Ссылка на текстовый список':'Proxy list URL','Или свои адреса, по одному на строку':'Or your proxies, one per line',
    'Сайт, который должен открываться':'Website that must be accessible',
    'Определять страну выходного IP после успешной проверки':'Look up the exit IP country after a successful check',
    '1. Быстрый параллельный отсев. 2. Проверка выбранного сайта только для ответивших прокси.':'1. Fast parallel screening. 2. Check the selected website only through responding proxies.',
    'Начать проверку':'Start checking','Остановить':'Stop','Готов к проверке':'Ready to check',
    'Прокси браузера':'Browser proxy','Прошедшие проверку':'Passed checks','Проверенные прокси':'Verified proxies',
    'Применять':'Apply to','Ко всем сайтам':'All websites','К выбранным доменам':'Selected domains',
    'Включить':'Enable','Выключить':'Disable','Экспорт результатов':'Export results','Поиск и проверка прокси':'Find and check proxies',
    'Локальное расширение без приложения TMPLAY. Список и результаты хранятся в этом профиле браузера. Страна — приблизительная геолокация IP через api.country.is.':'Standalone extension. Lists and results stay in this browser profile. Countries are approximate exit-IP locations from api.country.is.',
    'Язык':'Language','Автоматически':'Automatic','Русский':'Русский','English':'English',
    'Быстрый отсев':'Quick screening','1,2 с · быстрее':'1.2 s · faster','2,5 с · для медленных прокси':'2.5 s · for slower proxies',
    'Firefox: первый этап — до 8 параллельных проверок в неактивных вкладках. Затем проверяется выбранный сайт.':'Firefox: up to 8 parallel checks in inactive tabs in stage 1, followed by the selected website.',
    'Chrome: первый этап — до 32 параллельных проверок. На втором этапе запросы к проверяемому домену временно идут через тестируемый прокси. Остальные сайты сохраняют обычный маршрут.':'Chrome: up to 32 parallel checks in stage 1. During stage 2, requests to the tested domain temporarily use the candidate proxy. Other websites keep their usual route.',
    'Неподдерживаемый адрес':'Unsupported address','Активный адрес (из предыдущего списка)':'Active proxy (from a previous list)',
    'Прокси включён.':'Proxy enabled.','Настройка TMProxy выключена.':'TMProxy proxy setting disabled.',
    'Проверка остановлена. Готовые результаты сохранены.':'Checking stopped. Completed results were saved.',
    'Проверка завершена.':'Checking complete.','Проверка остановлена':'Checking stopped',
    'Проверено {done} / {total} · соединение: {alive} · сайт: {working}':'Checked {done} / {total} · responding: {alive} · website: {working}',
    'Этап 1 · {done} / {total} · ответили: {alive}':'Stage 1 · {done} / {total} · responding: {alive}',
    'Этап 2 · {done} / {total} · прошли: {working}':'Stage 2 · {done} / {total} · passed: {working}',
    'Быстрый этап: ответили {alive} / {total}':'Quick stage: {alive} / {total} responded',
    'Соединение/сайт недоступен, перенаправление или тайм-аут':'Connection or website unavailable, redirect error, or timeout',
    'Нужен HTTP/HTTPS адрес без логина и пароля.':'Enter an HTTP/HTTPS URL without a username or password.',
    'Для проверки укажите внешний сайт.':'Enter an external website to test.',
    'Прокси управляется другим расширением. Сначала выключите его.':'Another extension controls the proxy. Disable its proxy setting first.',
    'Отключите ручной/PAC-прокси в настройках соединения Firefox.':'Disable the manual/PAC proxy in Firefox connection settings.',
    'Сначала остановите текущую проверку.':'Stop the current check first.',
    'В списке нет поддерживаемых адресов. Проверьте протокол.':'The list has no supported addresses. Check the selected protocol.',
    'Загрузка списка остановлена':'List download stopped','Проверка уже запущена':'Checking is already running',
    'Проверкой управляет другая вкладка.':'Another tab controls this check.',
    'Сначала остановите проверку.':'Stop checking first.','Выберите проверенный адрес.':'Choose a verified proxy.',
    'Слишком много перенаправлений':'Too many redirects','мс':'ms',
    'Проверка соединения':'Checking connection','Проверка сайта':'Checking website',
    'ms':'мс'
  };
  const reverse=Object.fromEntries(Object.entries(messages).filter(([key])=>key!=='ms').map(([ru,en])=>[en,ru]));
  let locale='en';
  function system(){const api=typeof browser!=='undefined'?browser:chrome;return (api.i18n?.getUILanguage?.()||navigator.language||'en').toLowerCase().startsWith('ru')?'ru':'en';}
  function t(text,params={}){
    let value=reverse[text]||text;
    if(locale==='en')value=messages[value]||value;
    if(locale==='ru'&&value==='ms')value='мс';
    for(const [key,item]of Object.entries(params))value=value.replaceAll('{'+key+'}',String(item));
    if(locale==='en')value=value.replace(/^Список: HTTP /,'List: HTTP ').replace(/^Пропущено неподдерживаемых строк: /,'Unsupported lines skipped: ');
    return value;
  }
  const originals=new WeakMap(),attributes=new WeakMap();
  function set(value){
    locale=['ru','en'].includes(value)?value:system();
    if(typeof document==='undefined')return locale;
    document.documentElement.lang=locale;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      if(['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(node.parentElement?.tagName)||!node.nodeValue.trim())continue;
      if(!originals.has(node))originals.set(node,node.nodeValue);
      const original=originals.get(node);node.nodeValue=original.replace(original.trim(),t(original.trim()));
    }
    for(const node of document.querySelectorAll('[placeholder],[title],[aria-label],select option')){
      if(node.tagName==='OPTION'&&['history','selected'].includes(node.parentElement?.id))continue;
      if(!attributes.has(node))attributes.set(node,{placeholder:node.getAttribute('placeholder'),title:node.getAttribute('title'),'aria-label':node.getAttribute('aria-label'),text:node.tagName==='OPTION'?node.textContent:null});
      const original=attributes.get(node);for(const key of ['placeholder','title','aria-label'])if(original[key])node.setAttribute(key,t(original[key]));if(original.text)node.textContent=t(original.text);
    }
    return locale;
  }
  locale=system();root.TMProxyI18n={t,set,system,get language(){return locale;}};
})(globalThis);
