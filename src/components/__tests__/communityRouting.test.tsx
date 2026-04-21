import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from '@/components/Breadcrumbs';
import { NAV_ITEMS } from '@/config/nav';

describe('community routing labels', () => {
  it('renders the required breadcrumb on /community/reporter', () => {
    render(
      <MemoryRouter initialEntries={['/community/reporter']}>
        <Breadcrumbs />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Community Hub' })).toHaveAttribute('href', '/community');
    expect(screen.getByText('Community Reporter Queue')).toBeInTheDocument();
  });

  it('renders the required breadcrumb on /community', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <Breadcrumbs />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(screen.getByText('Community Hub')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Community Hub' })).not.toBeInTheDocument();
  });

  it('keeps canonical nav targets for hub and queue entries', () => {
    const communityHub = NAV_ITEMS.find((item) => item.key === 'community-hub');
    const communityQueue = NAV_ITEMS.find((item) => item.key === 'community-reporter-queue');

    expect(communityHub).toMatchObject({
      label: 'Community Hub',
      path: '/community',
    });
    expect(communityQueue).toMatchObject({
      label: 'Community Reporter Queue',
      path: '/community/reporter',
    });
  });
});