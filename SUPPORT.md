# Support

## Getting Help

If you need help with ICUPA, there are several ways to get support depending on your role and the type of issue.

## For Users (Diners, Merchants, Admin)

### Diners
If you're a customer using the ICUPA app to order food:

- **In-App Support:** Use the help icon in the app to contact venue staff
- **Venue Staff:** Ask your server or the venue manager for immediate assistance
- **Payment Issues:** Contact your payment provider (bank, mobile money operator)
- **Technical Issues:** Report via the app's feedback feature or contact the venue

### Merchants
If you're a venue owner or staff member:

- **Technical Support Email:** support@icupa.app
- **Response Time:** 24 hours for normal issues, 4 hours for urgent issues
- **WhatsApp Support:** [To be added] (if configured for your region)
- **Documentation:** Check the merchant portal help section
- **Training:** Contact your onboarding manager for training sessions

### Administrators
If you're managing the ICUPA platform:

- **Admin Portal:** Access help documentation within the admin console
- **Technical Support:** admin-support@icupa.app
- **Priority Support:** Available for production-impacting issues
- **Escalation:** Contact engineering team via designated channels

## For Developers

### Community Support

- **GitHub Discussions:** [https://github.com/ikanisa/icupa/discussions](https://github.com/ikanisa/icupa/discussions)
- **Documentation:** Read the [README.md](README.md) and docs in `/docs`
- **Code Examples:** Check `/examples` directory (if available)

### Issues and Bug Reports

For bugs, please [open an issue](https://github.com/ikanisa/icupa/issues/new) with:

- **Clear Title:** Describe the issue in one sentence
- **Environment:** OS, Node version, browser (if applicable)
- **Steps to Reproduce:** How to reproduce the bug
- **Expected Behavior:** What should happen
- **Actual Behavior:** What actually happens
- **Logs/Screenshots:** Include relevant error messages or screenshots

**Response Time:** 
- Critical bugs (security, data loss): Within 24 hours
- High priority (broken features): Within 3 business days
- Medium/Low priority: Within 1 week

### Feature Requests

We welcome feature requests! Please:

1. Check existing issues to avoid duplicates
2. Open a new issue with the `enhancement` label
3. Describe the problem you're trying to solve
4. Suggest a solution or implementation approach
5. Explain the use case and expected impact

**Feature requests are reviewed monthly** by the product team.

### Pull Requests

Before submitting a PR:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md)
2. Ensure tests pass: `pnpm test`
3. Run linter: `pnpm lint`
4. Update documentation if needed
5. Add tests for new features

**PR Review Time:** 1-2 weeks for small changes, longer for major features

## Support Channels

| Channel | Purpose | Response Time |
|---------|---------|---------------|
| GitHub Issues | Bug reports, feature requests | 1-7 days |
| GitHub Discussions | Questions, community help | Community-driven |
| Email: support@icupa.app | User/merchant support | 24 hours |
| Email: security@icupa.app | Security vulnerabilities | 48 hours |

## Service Level Agreements (SLAs)

### Production Support

| Severity | Description | Response Time | Resolution Target |
|----------|-------------|---------------|-------------------|
| P0 (Critical) | Service down, payments failing | 30 minutes | 4 hours |
| P1 (High) | Major feature broken, degraded performance | 4 hours | 24 hours |
| P2 (Medium) | Minor bugs, workaround available | 24 hours | 1 week |
| P3 (Low) | Cosmetic issues, feature requests | 1 week | Best effort |

### Development Support

- **Community Questions:** Best effort, usually 1-3 days
- **Bug Reports:** Triaged within 1 week, fixed based on priority
- **Feature Requests:** Reviewed monthly, scheduled based on roadmap

## Regional Support

### Rwanda
- **Business Hours:** Mon-Fri, 8:00 AM - 6:00 PM EAT (UTC+2)
- **Language:** English, Kinyarwanda
- **Payment Support:** MTN MoMo, Airtel Money
- **Fiscal Support:** Rwanda Revenue Authority (RRA) EBM 2.1 integration

### Malta
- **Business Hours:** Mon-Fri, 9:00 AM - 5:00 PM CET/CEST (UTC+1/+2)
- **Language:** English, Maltese
- **Payment Support:** Stripe (cards), bank transfers
- **Fiscal Support:** Malta fiscal receipt integration

## Escalation Path

If your issue isn't resolved within the expected timeframe:

1. **First Contact:** Wait for initial response time to elapse
2. **Follow Up:** Reply to your original issue/email with "ESCALATE"
3. **Manager Escalation:** Contact support@icupa.app with "ESCALATE" in subject
4. **Executive Escalation:** For critical production issues only

## Self-Service Resources

### Documentation
- **README:** [/README.md](README.md) - Quick start guide
- **Implementation Plan:** [/docs/implementation-plan.md](docs/implementation-plan.md)
- **Architecture:** [/docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Runbooks:** [/docs/runbooks/](docs/runbooks/)
- **Security:** [/SECURITY.md](SECURITY.md)

### Troubleshooting Guides
- **Database Issues:** [/docs/runbooks/fiscalization.md](docs/runbooks/fiscalization.md)
- **Payment Issues:** [/docs/runbooks/payments-timeout.md](docs/runbooks/payments-timeout.md)
- **AI Issues:** [/docs/runbooks/ai-kill-switch.md](docs/runbooks/ai-kill-switch.md)

### Common Issues

#### Installation Problems
- **Issue:** `pnpm: command not found`
- **Solution:** Install pnpm globally: `npm install -g pnpm@10`

#### Build Errors
- **Issue:** Build fails with missing env vars
- **Solution:** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in shell or `.env.local`

#### Test Failures
- **Issue:** Supabase tests fail
- **Solution:** Start Supabase locally: `supabase start && supabase db reset`

#### Deployment Issues
- **Issue:** Edge Functions not deploying
- **Solution:** Check Supabase CLI version: `supabase --version` (should be 2.x)

## Feedback

We value your feedback! Help us improve ICUPA:

- **User Feedback:** In-app feedback button
- **Developer Feedback:** GitHub Discussions
- **Feature Requests:** GitHub Issues with `enhancement` label
- **General Feedback:** feedback@icupa.app

## Contact Information

- **General Support:** support@icupa.app
- **Security Issues:** security@icupa.app
- **Business Inquiries:** business@icupa.app
- **GitHub:** https://github.com/ikanisa/icupa

## Status Page

Check system status and planned maintenance:
- **Status:** [To be added - e.g., status.icupa.app]

Subscribe to updates to receive notifications of incidents and maintenance windows.

---

**Last Updated:** 2025-10-29  
**Version:** 1.0

For urgent production issues outside business hours, please follow the escalation path above.
