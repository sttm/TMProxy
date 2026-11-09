# TMProxy

Standalone proxy checker and browser proxy manager for Chrome and Firefox. No TMPLAY desktop application or local server is required.

## Features

- HTTP, HTTPS, SOCKS4 and SOCKS5 proxy addresses.
- TXT/JSON list URLs and manually entered addresses; saved sources remember protocols.
- Parallel connectivity screening, then optional checks against YouTube or a selected website.
- Leave the target website empty to check connectivity only.
- Results sorted by measured latency, optional exit-IP country flags and export.
- Routing for all websites or selected domains and their subdomains.
- Optional automatic switching to another verified proxy when the active proxy fails.
- English and Russian UI; initially follows the browser language.

TMProxy does not provide a proxy service. Users supply addresses. Public proxies may stop working; website availability does not guarantee download access or bypass a service’s anti-bot checks.

## Build

Requires Python 3.10+ and Pillow. Run from the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tmproxy/requirements-build.txt
.venv/bin/python tools/build_tmproxy.py
```

On Windows use `.venv\Scripts\python.exe` instead of `.venv/bin/python`.

Outputs: `dist/tmproxy-chrome/`, `dist/tmproxy-firefox/` and browser ZIP packages, including versioned archives. The build packages bundled JavaScript, generates manifests/locales and resizes the included icon. There is no remote executable code or runtime build step.

## Local installation

Chrome 120+: open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/tmproxy-chrome`.

Firefox 142+: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/tmproxy-firefox/manifest.json`. Temporary installation lasts for that browser session; normal distribution requires Mozilla signing.

## Tests

Build first, then run with Node.js 22+:

```sh
node --test tests/test_tmproxy.cjs
```

Tests cover languages, TXT/JSON parsing, cancellation, sorting, automatic-switch candidate selection and Firefox consent declarations. Browser integration fixtures from the parent TMPLAY project are not included in this standalone repository.

## Checking and routing

Connectivity checks request Google’s HTTP connectivity endpoint through candidates (up to 32 at once in Chrome, 8 in Firefox). Fast mode allows 1.2 seconds for connectivity and 3 seconds for the selected website; a slower mode is also available. Website checks are sequential to keep Chrome HTTPS routing associated with the correct candidate.

Chrome uses PAC rules. During a website check, other requests to that same host can also use the candidate proxy; unrelated hosts retain their normal route. Firefox checks use short-lived inactive tabs with scripts/subresources blocked and cookies stripped. Firefox manual/PAC proxy settings or other proxy extensions can conflict with TMProxy.

Chrome does not support authenticated SOCKS proxies through this API. Firefox supports authenticated SOCKS5. Private/incognito browsing is not advertised as tested. If automatic switching has no verified replacement, the selected configuration stays in place; it does not intentionally fall back to DIRECT for protected traffic.

## Privacy

See [PRIVACY.md](PRIVACY.md). Settings and results stay in the browser profile. There is no developer-operated backend, analytics or cloud sync. Requests go to user-selected list providers, test websites, chosen proxy operators and optionally `api.country.is` for exit-IP country lookup. Firefox asks for optional location-data consent before country lookup. Proxy credentials are supplied only to the matching proxy challenge.

Public policy URL: https://github.com/sttm/TMProxy/blob/main/PRIVACY.md

## Store artwork

Assets and localized screenshots are in `tmproxy/store/`. Run `python3 tools/build_tmproxy_store.py` to regenerate promotional images. To capture the actual UI in a temporary Chrome profile, set `TMPLAY_CHROMIUM` to a Chrome for Testing executable and run `node tools/capture_tmproxy_store.cjs`. Then run `python3 tools/package_tmproxy_store.py` to validate and package store images. Capturing requires a Chrome build supporting unpacked extensions via command line. Screenshots show settings before checking, without simulated proxy results.

## License

[MIT](LICENSE).
