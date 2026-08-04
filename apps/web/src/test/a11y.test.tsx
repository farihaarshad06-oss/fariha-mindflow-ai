import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import { Button, EmptyState } from '@mindflow/ui';
import type { AxeMatchers } from 'vitest-axe';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface AsymmetricMatchersContaining extends AxeMatchers {}
}

expect.extend(axeMatchers);

describe('Accessibility smoke', () => {
  it('has no axe violations on a simple component', async () => {
    const { container } = render(
      <main>
        <Button>Save</Button>
        <EmptyState title="Nothing here" description="Add your first item" />
      </main>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
