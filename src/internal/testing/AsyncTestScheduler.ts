import { Observable } from '../Observable';
import { Notification } from '../Notification';
import { ColdObservable } from './ColdObservable';
import { HotObservable } from './HotObservable';
import { TestMessage } from './TestMessage';
import { SubscriptionLog } from './SubscriptionLog';
import { Subscription } from '../Subscription';
import { VirtualAction } from '../scheduler/VirtualTimeScheduler';
import { AsyncVirtualTimeScheduler } from '../scheduler/AsyncVirtualTimeScheduler';
import { AsyncScheduler } from '../scheduler/AsyncScheduler';
import { TestScheduler } from './TestScheduler';

const defaultMaxFrame: number = 750;

export interface RunHelpers {
  cold: typeof AsyncTestScheduler.prototype.createColdObservable;
  hot: typeof AsyncTestScheduler.prototype.createHotObservable;
  flush: typeof AsyncTestScheduler.prototype.flush;
  time: typeof AsyncTestScheduler.prototype.createTime;
  expectObservable: typeof AsyncTestScheduler.prototype.expectObservable;
  expectSubscriptions: typeof AsyncTestScheduler.prototype.expectSubscriptions;
}

interface FlushableTest {
  ready: boolean;
  actual?: any[];
  expected?: any[];
}

export type observableToBeFn = (marbles: string, values?: any, errorValue?: any) => void;
export type subscriptionLogsToBeFn = (marbles: string | string[]) => void;

export class AsyncTestScheduler extends AsyncVirtualTimeScheduler {
  /**
   * @deprecated remove in v8. Not for public use.
   */
  public readonly hotObservables: HotObservable<any>[] = [];

  /**
   * @deprecated remove in v8. Not for public use.
   */
  public readonly coldObservables: ColdObservable<any>[] = [];

  /**
   * Test meta data to be processed during `flush()`
   */
  private flushTests: FlushableTest[] = [];

  /**
   * Indicates whether the TestScheduler instance is operating in "run mode",
   * meaning it's processing a call to `run()`
   */
  private runMode = false;

  /**
   *
   * @param assertDeepEqual A function to set up your assertion for your test harness
   */
  constructor(public assertDeepEqual: (actual: any, expected: any) => boolean | void) {
    super(VirtualAction, defaultMaxFrame);
  }

  createTime(marbles: string): number {
    const indexOf = marbles.trim().indexOf('|');
    if (indexOf === -1) {
      throw new Error('marble diagram for time should have a completion marker "|"');
    }
    return indexOf * TestScheduler.frameTimeFactor;
  }

  /**
   * @param marbles A diagram in the marble DSL. Letters map to keys in `values` if provided.
   * @param values Values to use for the letters in `marbles`. If ommitted, the letters themselves are used.
   * @param error The error to use for the `#` marble (if present).
   */
  createColdObservable<T = string>(marbles: string, values?: { [marble: string]: T }, error?: any): ColdObservable<T> {
    if (marbles.indexOf('^') !== -1) {
      throw new Error('cold observable cannot have subscription offset "^"');
    }
    if (marbles.indexOf('!') !== -1) {
      throw new Error('cold observable cannot have unsubscription marker "!"');
    }
    const messages = TestScheduler.parseMarbles(marbles, values, error, undefined, this.runMode);
    const cold = new ColdObservable<T>(messages, this);
    this.coldObservables.push(cold);
    return cold;
  }

  /**
   * @param marbles A diagram in the marble DSL. Letters map to keys in `values` if provided.
   * @param values Values to use for the letters in `marbles`. If ommitted, the letters themselves are used.
   * @param error The error to use for the `#` marble (if present).
   */
  createHotObservable<T = string>(marbles: string, values?: { [marble: string]: T }, error?: any): HotObservable<T> {
    if (marbles.indexOf('!') !== -1) {
      throw new Error('hot observable cannot have unsubscription marker "!"');
    }
    const messages = TestScheduler.parseMarbles(marbles, values, error, undefined, this.runMode);
    const subject = new HotObservable<T>(messages, this);
    this.hotObservables.push(subject);
    return subject;
  }

  private materializeInnerObservable(observable: Observable<any>,
    outerFrame: number): TestMessage[] {
    const messages: TestMessage[] = [];
    observable.subscribe((value) => {
      messages.push({ frame: this.frame - outerFrame, notification: Notification.createNext(value) });
    }, (err) => {
      messages.push({ frame: this.frame - outerFrame, notification: Notification.createError(err) });
    }, () => {
      messages.push({ frame: this.frame - outerFrame, notification: Notification.createComplete() });
    });
    return messages;
  }

  expectObservable(observable: Observable<any>,
    subscriptionMarbles: string | null = null): ({ toBe: observableToBeFn }) {
    const actual: TestMessage[] = [];
    const flushTest: FlushableTest = { actual, ready: false };
    const subscriptionParsed = TestScheduler.parseMarblesAsSubscriptions(subscriptionMarbles, this.runMode);
    const subscriptionFrame = subscriptionParsed.subscribedFrame === Number.POSITIVE_INFINITY ?
      0 : subscriptionParsed.subscribedFrame;
    const unsubscriptionFrame = subscriptionParsed.unsubscribedFrame;
    let subscription: Subscription;

    this.schedule(() => {
      subscription = observable.subscribe(x => {
        let value = x;
        // Support Observable-of-Observables
        if (x instanceof Observable) {
          value = this.materializeInnerObservable(value, this.frame);
        }
        actual.push({ frame: this.frame, notification: Notification.createNext(value) });
      }, (err) => {
        actual.push({ frame: this.frame, notification: Notification.createError(err) });
      }, () => {
        actual.push({ frame: this.frame, notification: Notification.createComplete() });
      });
    }, subscriptionFrame);

    if (unsubscriptionFrame !== Number.POSITIVE_INFINITY) {
      this.schedule(() => subscription.unsubscribe(), unsubscriptionFrame);
    }

    this.flushTests.push(flushTest);
    const { runMode } = this;

    return {
      toBe(marbles: string, values?: any, errorValue?: any) {
        flushTest.ready = true;
        flushTest.expected = TestScheduler.parseMarbles(marbles, values, errorValue, true, runMode);
      }
    };
  }

  expectSubscriptions(actualSubscriptionLogs: SubscriptionLog[]): ({ toBe: subscriptionLogsToBeFn }) {
    const flushTest: FlushableTest = { actual: actualSubscriptionLogs, ready: false };
    this.flushTests.push(flushTest);
    const { runMode } = this;
    return {
      toBe(marbles: string | string[]) {
        const marblesArray: string[] = (typeof marbles === 'string') ? [marbles] : marbles;
        flushTest.ready = true;
        flushTest.expected = marblesArray.map(marbles =>
          TestScheduler.parseMarblesAsSubscriptions(marbles, runMode)
        );
      }
    };
  }

  flush(): Promise<void> {
    return Promise.resolve().then(() => {
      const hotObservables = this.hotObservables;
      while (hotObservables.length > 0) {
        hotObservables.shift()!.setup();
      }
      return super.flush();
    }).then(() => {
      this.flushTests = this.flushTests.filter(test => {
        if (test.ready) {
          this.assertDeepEqual(test.actual, test.expected);
          return false;
        }
        return true;
      });
    });
  }
 
  run<T>(callback: (helpers: RunHelpers) => Promise<T>): Promise<T> {
    const prevFrameTimeFactor = TestScheduler.frameTimeFactor;
    const prevMaxFrames = this.maxFrames;

    TestScheduler.frameTimeFactor = 1;
    this.maxFrames = Number.POSITIVE_INFINITY;
    this.runMode = true;
    AsyncScheduler.delegate = this;

    const helpers = {
      cold: this.createColdObservable.bind(this),
      hot: this.createHotObservable.bind(this),
      flush: this.flush.bind(this),
      time: this.createTime.bind(this),
      expectObservable: this.expectObservable.bind(this),
      expectSubscriptions: this.expectSubscriptions.bind(this),
    };
    let returnValue: T;
    return Promise.resolve()
      .then(() => callback(helpers))
      .then(ret => {
        returnValue = ret;
        return this.flush();
      })
      .then(() => returnValue)
      .finally(() => {
        TestScheduler.frameTimeFactor = prevFrameTimeFactor;
        this.maxFrames = prevMaxFrames;
        this.runMode = false;
        AsyncScheduler.delegate = undefined;
      });
  }
}
