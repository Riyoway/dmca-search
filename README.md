# dmca-search

Client-side search over [github/dmca](https://github.com/github/dmca), GitHub's public archive of DMCA takedown notices.

**Live:** https://riyoway.github.io/dmca-search/

## How it works

- A scheduled GitHub Actions workflow lists every notice in `github/dmca` (blobless clone + `git ls-tree`) and emits a compact JSON index.
- The site is fully static. Search runs in the browser over that index — no server, no tracking.
- Each result links to the original notice on GitHub; previews are fetched on demand from `raw.githubusercontent.com`.

## Usage

Type to search notice names (`nintendo`, `youtube-dl`, …). Multiple terms are ANDed.
Results can be filtered by year and by kind: notice, counter notice, retraction, reversal.

## Development

```sh
node scripts/build-index.mjs   # writes site/data/index.json
npx serve site                 # any static file server works
```

## License

MIT. The notices themselves are published by the upstream [github/dmca](https://github.com/github/dmca) repository; see its README for terms.
