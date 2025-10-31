## Description
<!-- Provide a clear and concise description of the changes -->

## Type of Change
<!-- Mark the appropriate option with an 'x' -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Security fix
- [ ] Infrastructure/DevOps
- [ ] Test improvements
- [ ] Dependency update

## Related Issues
<!-- Link to related issues -->

Fixes #(issue)
Relates to #(issue)

## Changes Made
<!-- List the specific changes made in this PR -->

- Change 1
- Change 2
- Change 3

## Testing
<!-- Describe the testing you've done -->

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

### Test Results
```bash
# Paste relevant test output here
```

### Manual Testing Steps
1. Step 1
2. Step 2
3. Expected result

## Screenshots/Videos
<!-- If applicable, add screenshots or videos to demonstrate the changes -->

### Before
<!-- Screenshot/video of before state -->

### After
<!-- Screenshot/video of after state -->

## Performance Impact
<!-- Describe any performance implications -->

- [ ] No significant performance impact
- [ ] Performance improvement (describe below)
- [ ] Potential performance regression (describe mitigation)

## Security Considerations
<!-- Any security implications of this change? -->

- [ ] No security impact
- [ ] Security improvement (describe)
- [ ] Potential security concern (describe and how it's mitigated)
- [ ] Reviewed by security team

## Database Changes
<!-- Does this PR include database migrations? -->

- [ ] No database changes
- [ ] Schema migration (forward only)
- [ ] Data migration
- [ ] Rollback migration included (.down.sql)

## Deployment Notes
<!-- Any special deployment considerations? -->

- [ ] Requires environment variable changes (list below)
- [ ] Requires configuration updates (list below)
- [ ] Requires data migration (describe below)
- [ ] Standard deployment process

### Environment Variables
<!-- List any new or changed environment variables -->

```bash
VARIABLE_NAME=description
```

### Configuration Changes
<!-- Describe any configuration changes needed -->

## Documentation
<!-- Has documentation been updated? -->

- [ ] Code comments added/updated
- [ ] README.md updated
- [ ] API documentation updated
- [ ] Runbook/operational docs updated
- [ ] CHANGELOG.md updated
- [ ] No documentation needed

## Checklist
<!-- Ensure all items are complete before requesting review -->

### Code Quality
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings

### Testing
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

### Security
- [ ] No secrets or credentials committed
- [ ] Dependencies are up to date (no high-severity CVEs)
- [ ] Security scan passed (if applicable)
- [ ] Input validation added where needed
- [ ] Authorization checks added where needed

### Deployment Readiness
- [ ] PR title is clear and descriptive
- [ ] PR is linked to relevant issue(s)
- [ ] All commits are signed (optional but recommended)
- [ ] No merge conflicts
- [ ] Target branch is correct (usually `main`)

## Reviewer Notes
<!-- Any specific areas you'd like reviewers to focus on? -->

## Rollback Plan
<!-- How can this change be rolled back if needed? -->

- [ ] Standard Git revert
- [ ] Requires database rollback (describe)
- [ ] Requires configuration rollback (describe)
- [ ] Feature flag (can be disabled without deployment)

## Additional Context
<!-- Add any other context about the PR here -->

---

## For Reviewers

### Review Focus
- [ ] Code quality and maintainability
- [ ] Test coverage and quality
- [ ] Security considerations
- [ ] Performance implications
- [ ] Documentation completeness
- [ ] Deployment risks

### Approval Criteria
- [ ] All automated checks pass
- [ ] Code review completed
- [ ] Security review completed (if needed)
- [ ] Product owner approval (if feature change)
