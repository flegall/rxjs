import { expect } from 'chai';
import {
  SchedulerAction,
  AsyncVirtualTimeScheduler,
  VirtualAction,
  AsyncVirtualTimeSchedulerExecutePromisesStrategy
} from 'rxjs';

/** @test {AsyncVirtualTimeScheduler} */
describe('AsyncVirtualTimeScheduler', () => {
  it('should exist', () => {
    expect(AsyncVirtualTimeScheduler).exist;
    expect(AsyncVirtualTimeScheduler).to.be.a('function');
  });

  it('should schedule things in order when flushed if each this is scheduled synchrously', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      invoked.push(state);
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 0, 2);
    v.schedule(invoke, 0, 3);
    v.schedule(invoke, 0, 4);
    v.schedule(invoke, 0, 5);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([1, 2, 3, 4, 5]);
    }).then(() => done(), done);
  });

  it('should schedule things in order when flushed if each this is scheduled at random', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      invoked.push(state);
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 100, 2);
    v.schedule(invoke, 0, 3);
    v.schedule(invoke, 500, 4);
    v.schedule(invoke, 0, 5);
    v.schedule(invoke, 100, 6);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([1, 3, 5, 2, 6, 4]);
    }).then(() => done(), done);
  });

  it('should schedule things in order when there are negative delays', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      invoked.push(state);
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 100, 2);
    v.schedule(invoke, 0, 3);
    v.schedule(invoke, -2, 4);
    v.schedule(invoke, 0, 5);
    v.schedule(invoke, -10, 6);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([6, 4, 1, 3, 5, 2]);
    }).then(() => done(), done);
  });

  it('should support recursive scheduling', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    let count = 0;
    const expected = [100, 200, 300];

    v.schedule<string>(function (this: SchedulerAction<string>, state?: string) {
      if (++count === 3) {
        return;
      }
      const virtualAction = this as VirtualAction<string>;
      expect(virtualAction.delay).to.equal(expected.shift());
      this.schedule(state, virtualAction.delay);
    }, 100, 'test');

    v.flush().then(() => {
      expect(count).to.equal(3);
    }).then(() => done(), done);
  });

  it('should not execute virtual actions that have been rescheduled before flush', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const messages: string[] = [];

    const action: VirtualAction<string> = <VirtualAction<string>> v.schedule(
      state => messages.push(state!),
      10,
      'first message'
    );

    action.schedule('second message', 10);

    v.flush().then(() => {
      expect(messages).to.deep.equal(['second message']);
    }).then(() => done(), done);
  });

  it('should execute only those virtual actions that fall into the maxFrames timespan', function (done: MochaDone) {
    const MAX_FRAMES = 50;
    const v = new AsyncVirtualTimeScheduler(AsyncVirtualTimeSchedulerExecutePromisesStrategy.usingSetImmediate, VirtualAction, MAX_FRAMES);
    const messages: string[] = ['first message', 'second message', 'third message'];

    const actualMessages: string[] = [];

    messages.forEach((message, index) => {
      v.schedule(
        state => actualMessages.push(state!),
        index * MAX_FRAMES,
        message
      );
    });

    v.flush().then(() => {
      expect(actualMessages).to.deep.equal(['first message', 'second message']);
      expect(v.actions.map(a => a.state)).to.deep.equal(['third message']);
    }).then(() => done(), done);
  });

  it('should pick up actions execution where it left off after reaching previous maxFrames limit', function (done: MochaDone) {
    const MAX_FRAMES = 50;
    const v = new AsyncVirtualTimeScheduler(AsyncVirtualTimeSchedulerExecutePromisesStrategy.usingSetImmediate, VirtualAction, MAX_FRAMES);
    const messages: string[] = ['first message', 'second message', 'third message'];

    const actualMessages: string[] = [];

    messages.forEach((message, index) => {
      v.schedule(
        state => actualMessages.push(state!),
        index * MAX_FRAMES,
        message
      );
    });

    v.flush()
      .then(() => {
        v.maxFrames = 2 * MAX_FRAMES;
       })
      .then(() => v.flush())
      .then(() => {
        expect(actualMessages).to.deep.equal(messages);
      })
      .then(() => done(), done);
  });

  it('should schedule promise resolutions in order when flushed if each this is scheduled synchrously', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      Promise.resolve().then(() => {invoked.push(state); });
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 0, 2);
    v.schedule(invoke, 0, 3);
    v.schedule(invoke, 0, 4);
    v.schedule(invoke, 0, 5);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([1, 2, 3, 4, 5]);
    }).then(() => done(), done);
  });

  it('should schedule promise resolutions in order when flushed if each this is scheduled at random', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      Promise.resolve().then(() => {invoked.push(state); });
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 100, 2);
    v.schedule(invoke, 0, 3);
    v.schedule(invoke, 500, 4);
    v.schedule(invoke, 0, 5);
    v.schedule(invoke, 100, 6);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([1, 3, 5, 2, 6, 4]);
    }).then(() => done(), done);
  });

  it('should schedule promise resolutions in order when there are negative delays', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      Promise.resolve().then(() => {invoked.push(state); });
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 100, 2);
    v.schedule(invoke, 0, 3);
    v.schedule(invoke, -2, 4);
    v.schedule(invoke, 0, 5);
    v.schedule(invoke, -10, 6);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([6, 4, 1, 3, 5, 2]);
    }).then(() => done(), done);
  });

  it('should support recursive scheduling within promises resolutions', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    let count = 0;
    const expected = [100, 200, 300];

    v.schedule<string>(function (this: SchedulerAction<string>, state?: string) {
      Promise.resolve().then(() => {
        if (++count === 3) {
          return;
        }
        const virtualAction = this as VirtualAction<string>;
        expect(virtualAction.delay).to.equal(expected.shift());
        this.schedule(state, virtualAction.delay);
      });
    }, 100, 'test');

    v.flush().then(() => {
      expect(count).to.equal(3);
    }).then(() => done(), done);
  });

  it('should execute only actions preceding errors and reject with the error', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler();
    const invoked: number[] = [];
    const invokeSuccess: any = (state: number) => {
      Promise.resolve().then(() => {invoked.push(state); });
    };
    const invokeError: any = () => {throw new Error('Error occured'); };
    v.schedule(invokeSuccess, 0, 1);
    v.schedule(invokeSuccess, 1, 2);
    v.schedule(invokeSuccess, 2, 3);
    v.schedule(invokeError, 3, 4);
    v.schedule(invokeSuccess, 4, 4);

    v.flush().then(() => {
      done(new Error('Expected an error to occur '));
    }, error => {
      expect(error.message).to.equal('Error occured');
      expect(invoked).to.deep.equal([1, 2, 3]);
      done();
    });
  });

  it('should execute promise resolutions using setImmediate', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler(
      AsyncVirtualTimeSchedulerExecutePromisesStrategy.usingSetImmediate
    );
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      Promise.resolve().then(() => { invoked.push(state); });
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 0, 2);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([1, 2]);
    }).then(() => done(), done);
  });

  it('should execute promise resolutions using setTimeout', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler(
      AsyncVirtualTimeSchedulerExecutePromisesStrategy.usingSetTimeout
    );
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      Promise.resolve().then(() => { invoked.push(state); });
    };
    v.schedule(invoke, 0, 1);
    v.schedule(invoke, 0, 2);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([1, 2]);
    }).then(() => done(), done);
  });

  it('should execute promise resolutions using a promises chain', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler(
      AsyncVirtualTimeSchedulerExecutePromisesStrategy.usingPromisesChain()
    );
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      Promise.resolve()
        .then(() => { invoked.push(state); });
    };
    v.schedule(invoke, 0, 1);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([1]);
    }).then(() => done(), done);
  });

  it('should not execute long promise resolutions using a limited promises chain', (done: MochaDone) => {
    const v = new AsyncVirtualTimeScheduler(
      AsyncVirtualTimeSchedulerExecutePromisesStrategy.usingPromisesChain(0)
    );
    const invoked: number[] = [];
    const invoke: any = (state: number) => {
      let array = [];
      for (let i = 0; i < 10; i++) {
        array.push(1);
      }

      array.reduce(
        (promise: Promise<number>, value: number) =>
          promise.then(() => Promise.resolve(value)),
        Promise.resolve(1)
      ).then(() => { invoked.push(state); });
    };
    v.schedule(invoke, 0, 1);

    v.flush().then(() => {
      expect(invoked).to.deep.equal([]);
    }).then(() => done(), done);
  });
});
