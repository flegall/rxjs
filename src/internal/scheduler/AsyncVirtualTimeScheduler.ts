import { AsyncAction } from './AsyncAction';
import { AsyncScheduler } from './AsyncScheduler';
import { VirtualAction } from './VirtualTimeScheduler';

export class AsyncVirtualTimeScheduler extends AsyncScheduler {

  /** @deprecated remove in v8. `frameTimeFactor` is not used in VirtualTimeScheduler directly. */
  static frameTimeFactor = 10;

  /**
   * The current frame for the state of the virtual scheduler instance. The the difference
   * between two "frames" is synonymous with the passage of "virtual time units". So if
   * you record `scheduler.frame` to be `1`, then later, observe `scheduler.frame` to be at `11`,
   * that means `10` virtual time units have passed.
   */
  public frame: number = 0;

  /**
   * Used internally to examine the current virtual action index being processed.
   * @deprecated remove in v8. Should be a private API.
   */
  public index: number = -1;

  /**
   * This creates an instance of a `VirtualTimeScheduler`. Experts only. The signature of
   * this constructor is likely to change in the long run.
   *
   * @param SchedulerAction The type of Action to initialize when initializing actions during scheduling.
   * @param maxFrames The maximum number of frames to process before stopping. Used to prevent endless flush cycles.
   */
  constructor(private executePromisesMicroTasks: () => Promise<void> = AsyncVirtualTimeSchedulerExecutePromisesStrategy.usingSetImmediate,
              SchedulerAction: typeof AsyncAction = VirtualAction as any,
              public maxFrames: number = Number.POSITIVE_INFINITY) {
    super(SchedulerAction, () => this.frame);
  }

  /**
   * Prompt the Scheduler to execute all of its queued actions, therefore
   * clearing its queue.
   * @return {void}
   */
  public flush(): Promise<void> {
    const {actions, maxFrames} = this;
    let error: any, action: AsyncAction<any> | undefined;
    if ((action = actions[0]) && action.delay <= maxFrames) {
      actions.shift();
      this.frame = action.delay;

      if (error = action.execute(action.state, action.delay)) {
        while (action = actions.shift()) {
          action.unsubscribe();
        }
        return Promise.reject(error);
      }
      return this.executePromisesMicroTasks().then(() => this.flush());
    } else {
      return Promise.resolve();
    }
  }
}

const executePromisesMicroTasksUsingSetImmediate: () => Promise<void> = () => {
  const nativeSetImmediate = typeof window !== `undefined` ?
    (window.setImmediate || undefined) :
    (global.setImmediate || undefined);
  return new Promise(resolve => {
    nativeSetImmediate(() => {
      resolve();
    });
  });
};

const executePromisesMicroTasksUsingSetTimeout: () => Promise<void> = () => {
  const nativeSetTimeout = typeof window !== `undefined` ?
    (window.setTimeout || undefined) :
    (global.setTimeout || undefined);
  return new Promise(resolve => {
    nativeSetTimeout(() => {
      resolve();
    }, 0);
  });
};

const defaultPromisesChainLength = 10;
const executePromisesMicroTasksUsingPromisesChain: (promisesChainLength?: number) => () => Promise<void> =
  (promisesChainLength = defaultPromisesChainLength) => () => {
    return new Promise(resolve => {
      let array = [];
      for (let i = 0; i < promisesChainLength; i++) {
        array.push(1);
      }

      array.reduce(
        (promise: Promise<number>, value: number) =>
          promise.then(() => Promise.resolve(value)),
        Promise.resolve(1)
      ).then(() => resolve());
    });
  };

export const AsyncVirtualTimeSchedulerExecutePromisesStrategy = {
  usingSetImmediate: executePromisesMicroTasksUsingSetImmediate,
  usingSetTimeout: executePromisesMicroTasksUsingSetTimeout,
  usingPromisesChain: executePromisesMicroTasksUsingPromisesChain,
};