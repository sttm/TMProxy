#!/usr/bin/env python3
"""Package and validate Chrome Web Store images after capture_tmproxy_store.cjs."""
from pathlib import Path
from PIL import Image
import shutil
import zipfile
import json

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'tmproxy/store'
out = ROOT / 'dist/tmproxy-store'
out.mkdir(parents=True, exist_ok=True)
images = []

def export(src, relative, size, mode='RGB'):
    dest = out / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as image:
        assert image.size == size, (src, image.size, size)
        image.convert(mode).save(dest)
    with Image.open(dest) as check:
        assert check.size == size and check.mode == mode
    images.append({'file': relative, 'width': size[0], 'height': size[1], 'mode': mode})

export(source / 'icon-128.png', 'icon-128.png', (128, 128), 'RGBA')
export(source / 'promo-440x280.png', 'promo-440x280.png', (440, 280))
export(source / 'marquee-1400x560.png', 'marquee-1400x560.png', (1400, 560))
for language in ('en', 'ru'):
    for name in ('01-overview.png', '02-checking-options.png', '03-domain-rules.png'):
        export(source / 'screenshots' / language / name, f'screenshots/{language}/{name}', (1280, 800))
export(source / 'screenshots/en/01-overview.png', 'screenshots/global/01-overview.png', (1280, 800))
(out / 'README.txt').write_text('''TMProxy — изображения для Chrome Web Store

Значок магазина: icon-128.png (128 × 128, PNG с прозрачными полями).
Маленькое рекламное изображение: promo-440x280.png.
Очень большое рекламное изображение: marquee-1400x560.png.

Локализованные скриншоты:
Русский: screenshots/ru/ — три изображения в порядке 01, 02, 03.
English: screenshots/en/ — три изображения в порядке 01, 02, 03.
Глобальные скриншоты: screenshots/global/01-overview.png (английский).
Глобальный скриншот повторяет первый английский: в одну галерею повторно не добавлять.

Все скриншоты: 1280 × 800. Скриншоты и баннеры: 24-битный RGB PNG без альфа-канала.
Скриншоты сняты с настоящего интерфейса расширения в отдельном профиле Chrome.
Показаны настройки до запуска проверки; результаты и скорость прокси не имитируются.

Требования: https://developer.chrome.com/docs/webstore/images
Архив содержит материалы карточки магазина, а не установочный пакет расширения.
''', encoding='utf-8')
(out / 'validation.json').write_text(json.dumps(images, ensure_ascii=False, indent=2)+'\n')
archive = ROOT / 'dist/tmproxy-chrome-store-assets.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for entry in images:
        bundle.write(out / entry['file'], entry['file'])
    for name in ('README.txt', 'validation.json'):
        bundle.write(out / name, name)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
print(f'{archive}\nValidated {len(images)} images; ZIP integrity OK.')
