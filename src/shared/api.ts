// to-do: type out the whole API, especially client / server contracts.

// to-do: this is just a demonstration of typing. Delete in favor of
//        `@devvit/web/server` `TriggerResponse` which actually doesn't have any
//        props.
export type TriggerResponse = {
  status: 'error' | 'ignored' | 'processed' | 'message';
  message?: string;
};
