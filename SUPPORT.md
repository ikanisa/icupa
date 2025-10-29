# Support

Thank you for using ICUPA! This document provides information on how to get help.

## Getting Help

### Documentation

Before asking for help, please check our documentation:

- **[Architecture Documentation](docs/ARCHITECTURE.md)**: Understand the system structure
- **[Contributing Guide](CONTRIBUTING.md)**: Learn how to contribute
- **[Release Runbooks](docs/runbooks/)**: Deployment and operational procedures
- **[Testing Guide](docs/testing.md)**: Testing strategies and practices

### Common Issues

#### Build Issues

**Problem**: Build fails with `pnpm: command not found`
```bash
# Solution: Install pnpm globally
npm install -g pnpm@10
```

**Problem**: Build fails with missing environment variables
```bash
# Solution: Set required environment variables
VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test pnpm build
```

#### Development Issues

**Problem**: Supabase local development not working
```bash
# Solution: Make sure Docker is running, then:
supabase start
supabase db reset --local --yes
```

**Problem**: Lint errors in ecotrips apps
```text
# Note: These are pre-existing and can be ignored unless you're modifying those files
```

#### Test Issues

**Problem**: Tests fail with DB connection errors
```text
# Note: DB-dependent tests are automatically skipped if Supabase CLI is not available
# To run full tests, ensure Supabase is running locally
```

### Community Support

For general questions, discussions, and community support:

- **GitHub Discussions**: [ikanisa/icupa/discussions](https://github.com/ikanisa/icupa/discussions)
- **Bug Reports**: [Open an issue](https://github.com/ikanisa/icupa/issues/new?template=bug_report.md)
- **Feature Requests**: [Open an issue](https://github.com/ikanisa/icupa/issues/new?template=feature_request.md)

### Professional Support

For commercial support, consulting, or custom development:

- **Email**: support@icupa.app
- **Enterprise**: enterprise@icupa.app

## What to Include in Support Requests

When asking for help, please include:

1. **Environment Information**:
   - Node version (`node --version`)
   - pnpm version (`pnpm --version`)
   - Operating system

2. **Problem Description**:
   - What you were trying to do
   - What you expected to happen
   - What actually happened
   - Error messages (full text)

3. **Steps to Reproduce**:
   - Minimal code example
   - Commands you ran
   - Configuration files (sanitized)

4. **What You've Tried**:
   - Solutions you've already attempted
   - Documentation you've consulted

## Response Times

Response times vary based on the channel:

| Channel            | Expected Response Time |
| ------------------ | ---------------------- |
| GitHub Issues      | 2-5 business days      |
| GitHub Discussions | 1-3 business days      |
| Security Reports   | 48 hours               |
| Enterprise Email   | 24 hours               |

**Note**: These are targets, not guarantees. Community support is provided on a best-effort basis.

## Out of Scope

The following are outside the scope of community support:

- Custom development for specific use cases
- Debugging third-party integrations
- Performance tuning for specific deployments
- Production environment issues (use enterprise support)

## Contributing

The best way to get help is to help others! Consider:

- Answering questions in GitHub Discussions
- Improving documentation
- Fixing bugs
- Adding tests

See our [Contributing Guide](CONTRIBUTING.md) for more information.

## Code of Conduct

All community interactions must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

We are committed to providing a welcoming and inclusive environment for everyone.

## Security Issues

**Do not use public support channels for security vulnerabilities.**

See our [Security Policy](SECURITY.md) for how to report security issues.

## Resources

### Learning Resources

- **React**: https://react.dev
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Supabase**: https://supabase.com/docs
- **Vite**: https://vitejs.dev
- **Tailwind CSS**: https://tailwindcss.com

### ICUPA-Specific Resources

- **Agent System**: [docs/agents/policy.md](docs/agents/policy.md)
- **AI Features**: [docs/ai/usage.md](docs/ai/usage.md)
- **Observability**: [docs/observability.md](docs/observability.md)
- **Backend Contract**: [docs/backend-contract.md](docs/backend-contract.md)

## Contact Information

- **General Support**: support@icupa.app
- **Security**: security@icupa.app
- **Enterprise**: enterprise@icupa.app
- **Press/Media**: press@icupa.app

---

Thank you for being part of the ICUPA community! 🎉
