import { Subscription } from '../Subscription';
import { SchedulerLike } from '../types';

export const asyncScheduler: SchedulerLike = {
  now() {
    return Date.now();
  },
  schedule<T>(work: (state: T) => void, delay = 0, state = undefined as T, subs?: Subscription): Subscription {
    subs = subs || new Subscription();
    const id = setTimeout(() => work(state), delay);
    subs.add(() => clearTimeout(id));
    return subs;
  }
}
