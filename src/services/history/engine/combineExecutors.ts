import type { Command, CommandExecutor } from './types';

/**
 * Combines several CommandExecutors into one.
 */
export function combineExecutors(...executors: CommandExecutor[]): CommandExecutor {
  return {
    async apply(command: Command) {
      for (const executor of executors) {
        await executor.apply(command);
      }
    },
    async invert(command: Command) {
      for (const executor of executors) {
        await executor.invert(command);
      }
    },
  };
}
