# Contributing

Bug reports and focused design discussions are welcome. Before proposing a
code change, open an issue describing the behavior and test case. By submitting
a contribution, you agree that it may be distributed under this repository's
MIT License.

For local verification:

```powershell
npm install
npm test
```

Tests use a mock mpv named pipe and do not require mpv or Chrome. Changes to
tracking, delivery, recovery, or packaging should include a regression test.
