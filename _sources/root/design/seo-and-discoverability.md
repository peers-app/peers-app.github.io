# SEO and Discoverability Roadmap

## Current State (completed)

- Canonical URLs on all pages pointing to `https://peers.app/`
- Open Graph meta tags on all pages (title, description, image, url, site_name)
- Twitter Card meta tags on all pages
- JSON-LD structured data (`SoftwareApplication` schema) on landing page
- `robots.txt` allowing crawling, disallowing `/account`
- `sitemap.xml` covering `/`, `/landing`, `/download`, `/privacy`
- Semantic HTML with proper heading hierarchy
- Keyword-rich meta descriptions
- Mobile-responsive layout

## Technical Items (code changes)

### Publish articles as web pages

The `servers-solve-three-problems.md` article is excellent long-form content packed with keywords people search for ("local-first", "peer-to-peer architecture", "end-to-end encryption", "WebRTC", "decentralized apps"). Publishing it as a web page at `/articles/servers-solve-three-problems` would give search engines substantial, unique content to index. Long-form technical content like this ranks very well.

An `/articles` index page could serve as a lightweight blog. Other article candidates:
- The "toy apps that scale" piece (referenced in TODO)
- A practical guide to setting up Peers
- Comparison with traditional cloud-based alternatives

### FAQ section with structured data

Add a few Q&As to the landing page ("Is my data really private?", "Does it work offline?", "Is it free?") with `FAQPage` JSON-LD schema. Google sometimes renders these as rich results (expandable Q&A directly in search results), which dramatically increases click-through rate.

### Lighthouse SEO audit

Run a Lighthouse audit on all pages and fix any flagged issues (missing alt text, tap target sizes, contrast ratios, etc.).

### Internal linking

More cross-links between pages improves crawlability. The landing page could link to articles, the download page could link back to specific features, etc.

## Testing and Validation Tools

| Tool | What it checks | URL |
|------|---------------|-----|
| Google Rich Results Test | Validates JSON-LD structured data | https://search.google.com/test/rich-results |
| Facebook Sharing Debugger | Shows how OG tags render in previews | https://developers.facebook.com/tools/debug/ |
| Twitter Card Validator | Preview Twitter Cards | https://cards-dev.twitter.com/validator |
| Lighthouse (Chrome DevTools) | Full SEO audit with scores | Built into Chrome F12 |
| PageSpeed Insights | Performance + Core Web Vitals | https://pagespeed.web.dev/ |
| Google Mobile-Friendly Test | Mobile rendering check | https://search.google.com/test/mobile-friendly |

## Post-Deploy Steps (after migrating to peers.app)

1. **Google Search Console** — Submit sitemap, monitor indexing, see which queries surface the site, get notified of issues. This is the single most important post-launch step.
2. **Bing Webmaster Tools** — Same thing for Bing/DuckDuckGo (DuckDuckGo uses Bing's index).
3. Search `site:peers.app` on Google after a week or two to verify pages are indexed.

## Broader Strategy (not code)

- **Product Hunt launch** — good for initial traffic spike and backlinks
- **Hacker News** — the `servers-solve-three-problems` article is exactly the kind of content HN loves. Could drive significant traffic and backlinks.
- **AlternativeTo.net** — list Peers as an alternative to Notion, Obsidian, Google Keep, etc.
- **Reddit** — r/selfhosted, r/privacy, r/degoogle communities are the target audience
- **GitHub README** — make sure the peers-app repo README links to peers.app prominently
