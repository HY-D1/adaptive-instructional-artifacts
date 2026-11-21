import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Popover } from './popover';

describe('Popover', () => {
  it('opens on click and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Popover triggerLabel="Open menu" trigger={<span>Menu</span>} panelTestId="panel">
        <p>Inside</p>
      </Popover>,
    );
    expect(screen.queryByTestId('panel')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByTestId('panel').textContent).toContain('Inside');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('panel')).toBeNull());
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <Popover triggerLabel="Open menu" trigger={<span>Menu</span>} panelTestId="panel">
          <p>Inside</p>
        </Popover>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByTestId('panel')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() => expect(screen.queryByTestId('panel')).toBeNull());
  });

  it('gives the panel a close function', async () => {
    const user = userEvent.setup();
    render(
      <Popover triggerLabel="Open menu" trigger={<span>Menu</span>} panelTestId="panel">
        {(close) => <button type="button" onClick={close}>Done</button>}
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('panel')).toBeNull());
  });
});
