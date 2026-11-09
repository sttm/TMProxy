# TMProxy — privacy and data transmission

Version 1.3.2 · 9 November 2026

TMProxy stores settings, list sources, proxy addresses, optional proxy credentials, results and automatic-switching status locally in the browser profile. The extension has no developer-operated backend, analytics, advertising SDK or cloud sync. The developer does not receive proxy lists or browsing-history uploads from this code.

When the user loads a list, TMProxy contacts the supplied URL. Connection checks contact Google's connectivity endpoint through each candidate proxy. If a target website is provided, the extension requests that website through candidates. Automatic switching repeats connection/target checks while enabled.

When browser proxying is enabled, the browser routes the selected traffic through the proxy operator chosen by the user. That operator receives the connection/domain information needed to route traffic and, for HTTP, can receive request/response contents. TMProxy does not decrypt or copy protected HTTPS page contents. Proxy credentials entered by the user are supplied to the matching proxy's authentication challenge, not to a developer server or website login form.

Optional country lookup contacts api.country.is through the candidate proxy to determine its approximate exit-IP country. This is not device GPS location. In Firefox, this feature additionally requires optional `locationInfo` consent. Declining or revoking it leaves proxy checking available without country lookup. A blank target website skips target and country checks.

Firefox declarations cover `browsingActivity`, `websiteContent` and `authenticationInfo` for the proxy/checking functionality, and optional `locationInfo` for exit-country lookup. Firefox 142 or newer is required so consent can use the browser's built-in experience. These categories do not mean that this extension runs a developer collection service.

The user controls proxy enablement, selected domains, automatic switching and country lookup. Results can be exported by the user's explicit action. Local data can be removed by uninstalling the extension/clearing its browser storage. Proxy operators, user-supplied list providers, target websites and the country service apply their own policies to requests they receive.

# Конфиденциальность и передача данных

TMProxy сохраняет настройки, источники списков, адреса, учётные данные прокси, результаты и статус автопереключения локально в браузере. Собственного сервера разработчика, аналитики, рекламных SDK и облачной синхронизации нет.

Сетевые запросы выполняются к указанному пользователем списку, службе проверки соединения Google, выбранному сайту и, при включённой геолокации, api.country.is через проверяемый прокси. Когда прокси включён, выбранный трафик браузера направляется оператору этого прокси. HTTPS-содержимое расширение не расшифровывает и не копирует. Введённые логин/пароль передаются только соответствующему прокси для авторизации.

Для флагов стран определяется приблизительная страна выходного IP, а не GPS устройства. Firefox дополнительно запрашивает необязательное разрешение `locationInfo`; без него проверка адресов продолжает работать без геолокации. При пустом поле сайта запросы к сайту и геолокации пропускаются.

В Firefox-манифесте указаны категории `browsingActivity`, `websiteContent`, `authenticationInfo` для работы прокси и необязательная `locationInfo` для страны IP. Сборка требует Firefox 142+. Параметры доступны пользователю в интерфейсе расширения; отдельные данные можно удалить очисткой хранилища браузера или удалением расширения. Политики внешних сервисов и операторов прокси действуют отдельно.

Technical reference: [Mozilla data-consent documentation](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).
