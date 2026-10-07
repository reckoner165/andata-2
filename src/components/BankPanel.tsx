import { Tabs } from 'radix-ui';
import type { ReactNode } from 'react';

interface Props {
  control: ReactNode;
  videoFx: ReactNode;
}

/** The bank column: "control" (the four bank strips) and "videofx" tabs. */
export function BankPanel({ control, videoFx }: Props) {
  return (
    <Tabs.Root className="banks" defaultValue="control">
      <Tabs.List className="banks__tabs" aria-label="Bank panel">
        <Tabs.Trigger value="control" className="banks__tab">
          control
        </Tabs.Trigger>
        <Tabs.Trigger value="videofx" className="banks__tab">
          videofx
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="control" className="banks__content">
        {control}
      </Tabs.Content>
      <Tabs.Content value="videofx" className="banks__content">
        {videoFx}
      </Tabs.Content>
    </Tabs.Root>
  );
}
