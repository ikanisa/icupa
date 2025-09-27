import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ActionDock } from '@/components/client/ActionDock';
import { AIChatScreen } from '@/components/client/AIChatScreen';
import { MenuItemDrawer } from '@/components/client/MenuItemDrawer';
import { menuItems } from '@/data/menu';

describe('Phase 3 diner experience accessibility', () => {
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
  });

  it('AI chat placeholder respects accessible form semantics', async () => {
    const { container } = render(<AIChatScreen />);

    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });

    expect(results.violations).toHaveLength(0);
  });

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
  });
});
