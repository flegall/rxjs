import { AsyncAction } from './AsyncAction';
import { Subscription } from '../Subscription';
import { AsyncScheduler } from './AsyncScheduler';
import { SchedulerAction } from '../types';

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
  constructor(SchedulerAction: typeof AsyncAction = AsyncVirtualAction as any,
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
      return this.executePromises().then(() => this.flush());
    } else {
      return Promise.resolve();
    }
  }

  private executePromises(): Promise<void> {
    return new Promise(resolve => {
      setImmediate(() => {
        resolve();
      })
    });
  }
}

export class AsyncVirtualAction<T> extends AsyncAction<T> {

  protected active: boolean = true;

  constructor(protected scheduler: AsyncVirtualTimeScheduler,
              protected work: (this: SchedulerAction<T>, state?: T) => void,
              protected index: number = scheduler.index += 1) {
    super(scheduler, work);
    this.index = scheduler.index = index;
  }

  public schedule(state?: T, delay: number = 0): Subscription {
    if (!this.id) {
      return super.schedule(state, delay);
    }
    this.active = false;
    // If an action is rescheduled, we save allocations by mutating its state,
    // pushing it to the end of the scheduler queue, and recycling the action.
    // But since the VirtualTimeScheduler is used for testing, VirtualActions
    // must be immutable so they can be inspected later.
    const action = new AsyncVirtualAction(this.scheduler, this.work);
    this.add(action);
    return action.schedule(state, delay);
  }

  protected requestAsyncId(scheduler: AsyncVirtualTimeScheduler, id?: any, delay: number = 0): any {
    this.delay = scheduler.frame + delay;
    const {actions} = scheduler;
    actions.push(this);
    (actions as Array<AsyncVirtualAction<T>>).sort(AsyncVirtualAction.sortActions);
    return true;
  }

  protected recycleAsyncId(scheduler: AsyncVirtualTimeScheduler, id?: any, delay: number = 0): any {
    return undefined;
  }

  protected _execute(state: T, delay: number): any {
    if (this.active === true) {
      return super._execute(state, delay);
    }
  }

  public static sortActions<T>(a: AsyncVirtualAction<T>, b: AsyncVirtualAction<T>) {
    if (a.delay === b.delay) {
      if (a.index === b.index) {
        return 0;
      } else if (a.index > b.index) {
        return 1;
      } else {
        return -1;
      }
    } else if (a.delay > b.delay) {
      return 1;
    } else {
      return -1;
    }
  }
}
