#!/usr/bin/env python3
"""Package Chrome/Firefox TMProxy with blue globe icons and RU/EN locales."""
import io
import json
from pathlib import Path
import shutil
import zipfile

ROOT=Path(__file__).resolve().parents[1]
from PIL import Image
master=Image.open(ROOT/'tmproxy/assets/globe-master.png').convert('RGBA')
icons={}
for size in (16,32,48,128):
 output=io.BytesIO();master.resize((size,size),Image.Resampling.LANCZOS).save(output,format='PNG');icons[size]=output.getvalue()
for browser in ('chrome','firefox'):
 target=ROOT/'dist'/('tmproxy-'+browser)
 if target.exists():shutil.rmtree(target)
 target.mkdir(parents=True)
 for name in ('background.js','db.js','dashboard.html','popup.html','ui.js','ui.css','i18n.js','list-parser.js','failover-policy.js'):shutil.copyfile(ROOT/'tmproxy'/name,target/name)
 shutil.copyfile(ROOT/'extension/proxy-core.js',target/'proxy-core.js')
 (target/'icons').mkdir()
 for language,description in {'en':'Find and check proxies. Fast parallel screening, then YouTube or your selected website.','ru':'Поиск и проверка прокси. Быстрый параллельный отсев, затем YouTube или выбранный сайт.'}.items():
  locale=target/'_locales'/language;locale.mkdir(parents=True);(locale/'messages.json').write_text(json.dumps({'description':{'message':description}},ensure_ascii=False,indent=2)+'\n')
 for size,data in icons.items():(target/f'icons/{size}.png').write_bytes(data)
 manifest=dict(manifest_version=3,name='TMProxy',version='1.3.2',default_locale='en',description='__MSG_description__',permissions=['proxy','storage','unlimitedStorage','webRequest','alarms'],host_permissions=['<all_urls>'],icons={str(n):f'icons/{n}.png' for n in icons},action=dict(default_popup='popup.html',default_icon={str(n):f'icons/{n}.png' for n in (16,32,48)}))
 if browser=='chrome':manifest.update(minimum_chrome_version='120',background=dict(service_worker='background.js'));manifest['permissions'].append('webRequestAuthProvider')
 else:manifest.update(background=dict(scripts=['proxy-core.js','db.js','list-parser.js','failover-policy.js','background.js']),browser_specific_settings=dict(gecko=dict(id='tmproxy@producerscenter.com',strict_min_version='142.0',data_collection_permissions=dict(required=['authenticationInfo','browsingActivity','websiteContent'],optional=['locationInfo']))));manifest['permissions'].extend(['webRequestBlocking','scripting'])
 (target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 with zipfile.ZipFile(target.with_suffix('.zip'),'w',zipfile.ZIP_DEFLATED) as archive:
  for item in sorted(target.rglob('*')):
   if item.is_file():archive.write(item,item.relative_to(target).as_posix())
 shutil.copyfile(target.with_suffix('.zip'),target.parent/(target.name+'-'+manifest['version']+'.zip'))
 print(target)
