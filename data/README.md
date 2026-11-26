# Static data

This directory is reserved for data files shipped with the app shell (for example, an
offline institution list). There are no such files yet: institution lookup happens at
runtime through Wikidata and paper metadata comes from Archive.org.

Anything added here must be listed in `sw.js`'s `SHELL` and mentioned in `AGENTS.md`,
as required by `tests/shell.test.js`.
