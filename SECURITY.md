# Security Policy

## Reporting a Vulnerability

The ICUPA team takes security seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities by emailing: **security@icupa.app**

Include the following information in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (if applicable)

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
2. **Assessment**: We will assess the vulnerability and determine its severity within 5 business days.
3. **Updates**: We will keep you informed of our progress as we work on a fix.
4. **Resolution**: Once the vulnerability is fixed, we will notify you and publicly disclose the issue (with credit to you, if desired).

### Disclosure Policy

- We ask that you do not publicly disclose the vulnerability until we have had a chance to address it.
- We will work with you to understand the scope of the issue and develop a fix.
- Once fixed, we will coordinate the public disclosure with you.

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < main  | :x:                |

We recommend always using the latest version from the `main` branch in production.

## Security Best Practices

### For Contributors

When contributing to ICUPA:

1. **Never commit secrets**: Use environment variables for sensitive data
2. **Review dependencies**: Check for known vulnerabilities before adding new dependencies
3. **Follow secure coding practices**: 
   - Validate all inputs
   - Use parameterized queries (we use Supabase with proper RLS)
   - Implement proper authentication and authorization
   - Sanitize outputs to prevent XSS

### For Deployers

When deploying ICUPA:

1. **Use HTTPS**: Always use TLS in production
2. **Rotate secrets regularly**: Especially API keys and tokens
3. **Keep dependencies updated**: Monitor for security updates
4. **Use strong authentication**: Enable MFA where possible
5. **Monitor logs**: Watch for suspicious activity
6. **Backup regularly**: Maintain secure backups of your data

## Security Features

ICUPA implements several security features:

- **Row Level Security (RLS)**: Database access is controlled at the row level
- **Secret scanning**: CI pipeline checks for accidentally committed secrets
- **Authentication**: Supabase Auth with multiple providers (WhatsApp OTP, magic links)
- **Session management**: Secure session handling with `x-icupa-session` headers
- **PII protection**: Logs are scrubbed of personally identifiable information
- **Age gates**: For alcohol and age-restricted content
- **Allergen safety**: AI guardrails for allergen information

## Scope

The following are in scope for security reports:

- Authentication and authorization bypasses
- SQL injection
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Server-side request forgery (SSRF)
- Remote code execution
- Data exposure
- PII leakage in logs or responses

The following are generally out of scope:

- Issues in third-party dependencies (report these upstream)
- Social engineering attacks
- Physical attacks
- Denial of service attacks
- Issues requiring physical access to a user's device

## Security Updates

Security updates will be:

1. Applied to the `main` branch immediately
2. Documented in our release notes
3. Announced via GitHub security advisories
4. Communicated to known deployers

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [CWE Top 25](https://cwe.mitre.org/top25/)

## Questions?

If you have questions about this security policy, please contact: **security@icupa.app**
