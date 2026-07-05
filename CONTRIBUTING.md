# Contributing

Thanks for contributing to MedWear Health Analytics.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Before opening a PR

```bash
npm run test:server
npm run evaluate
npm audit --audit-level=high
```

## Guidelines

- Keep changes focused; match existing code style
- Never commit real Apple Health exports, API keys, or `.env`
- Benchmark data must remain synthetic

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

Contributions are licensed under [MIT](LICENSE).
