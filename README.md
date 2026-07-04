# dmca-search

Client-side search over [github/dmca](https://github.com/github/dmca), GitHub's public archive of DMCA takedown notices.

**Live:** https://dmca-search.riyo.me

## How it works

- The build (`scripts/build-index.mjs`) lists every notice in `github/dmca` (blobless clone + `git ls-tree`) and emits a compact JSON index.
- The site is fully static. Search runs in the browser over that index — no server, no tracking.
- Each result links to the original notice on GitHub; previews are fetched on demand from `raw.githubusercontent.com`, with `[private]` markers shown as redactions.
- Hosted on Vercel, which runs the build on every deploy; a daily GitHub Actions job re-deploys so the index stays current.

## Usage

Type to search notice names (`nintendo`, `youtube-dl`, …). Multiple terms are ANDed.
Results can be filtered by year and by kind: notice, counter notice, retraction, reversal.

## Development

```sh
npm run build      # writes site/data/index.json
npx serve site     # any static file server works
```

Deploy with `vercel --prod` (build runs on Vercel; no committed index).

## License

MIT. The notices themselves are published by the upstream [github/dmca](https://github.com/github/dmca) repository; see its README for terms.
