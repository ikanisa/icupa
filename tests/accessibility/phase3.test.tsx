import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { QueryClientProvider } from '@tanstack/react-query';
import { ActionDock } from '@/components/client/ActionDock';
import { AIChatScreen } from '@/components/client/AIChatScreen';
import { MenuItemDrawer } from '@/components/client/MenuItemDrawer';
import { menuItems } from '@/data/menu';
import { createQueryClient } from '@/modules/core/providers/queryClient';

describe.sequential('Phase 3 diner experience accessibility', () => {
  let originalScrollIntoView: ((options?: ScrollIntoViewOptions | boolean) => void) | undefined;

  beforeAll(() => {
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  const queryClient = createQueryClient();

  it('action dock navigation has no critical accessibility issues', async () => {
    const { container } = render(
      <ActionDock activeTab="menu" onTabChange={() => {}} cartItemCount={4} />,
    );

    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });

    expect(results.violations).toHaveLength(0);
  }, 10_000);

  it('AI chat placeholder respects accessible form semantics', async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AIChatScreen />
      </QueryClientProvider>,
    );

    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });

    expect(results.violations).toHaveLength(0);
  }, 10_000);

  it('menu item drawer surfaces allergens and pricing accessibly', async () => {
    const sampleItem = menuItems[0];
    const { container } = render(
      <MenuItemDrawer
        item={sampleItem}
        open
        currency="EUR"
        locale="en-MT"
        onClose={() => {}}
        onAddToCart={() => {}}
      />,
    );

    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });

    expect(results.violations).toHaveLength(0);
  }, 10_000);
});
