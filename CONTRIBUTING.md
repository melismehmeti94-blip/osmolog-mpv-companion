# Contributing

Bug reports and focused design discussions are welcome. Before proposing a
code change, open an issue describing the behavior and test case. A formal
source license has not yet been selected, so outside pull requests should wait
until contribution and licensing terms are published.

For local verification:

```powershell
npm install
npm test
```

Tests use a mock mpv named pipe and do not require mpv or Chrome. Changes to
tracking, delivery, recovery, or packaging should include a regression test.
