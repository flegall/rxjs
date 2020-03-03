import { expect } from 'chai';
import { AsyncScheduler } from 'rxjs/internal/scheduler/AsyncScheduler';
import { AsyncTestScheduler } from 'rxjs/testing';
import { Observable, Subject, of, merge, from } from 'rxjs';
import { delay, debounceTime, concatMap, switchMap, startWith} from 'rxjs/operators';

/** @test {AsyncTestScheduler} */
describe('AsyncTestScheduler', () => {
  it('should exist', () => {
    expect(AsyncTestScheduler).exist;
    expect(AsyncTestScheduler).to.be.a('function');
  });

  it('should have frameTimeFactor set initially', () => {
    expect(AsyncTestScheduler.frameTimeFactor).to.equal(10);
  });

  describe('createTime()', () => {
    it('should parse a simple time marble string to a number', () => {
      const scheduler = new AsyncTestScheduler(null!);
      const time = scheduler.createTime('-----|');
      expect(time).to.equal(50);
    });

    it('should throw if not given good marble input', () => {
      const scheduler = new AsyncTestScheduler(null!);
      expect(() => {
        scheduler.createTime('-a-b-#');
      }).to.throw();
    });
  });

  describe('createColdObservable()', () => {
    it('should create a cold observable', (done: MochaDone) => {
      const expected = ['A', 'B'];
      const scheduler = new AsyncTestScheduler(null!);
      const source = scheduler.createColdObservable('--a---b--|', { a: 'A', b: 'B' });
      expect(source).to.be.an.instanceOf(Observable);
      source.subscribe(x => {
        expect(x).to.equal(expected.shift());
      });
      scheduler.flush().then(() => {
        expect(expected.length).to.equal(0);
      }).then(() => done(), done);
    });
  });

  describe('createHotObservable()', () => {
    it('should create a hot observable', (done: MochaDone) => {
      const expected = ['A', 'B'];
      const scheduler = new AsyncTestScheduler(null!);
      const source = scheduler.createHotObservable('--a---b--|', { a: 'A', b: 'B' });
      expect(source).to.be.an.instanceof(Subject);
      source.subscribe(x => {
        expect(x).to.equal(expected.shift());
      });
      scheduler.flush().then(() => {
        expect(expected.length).to.equal(0);
      }).then(() => done(), done);
    });
  });
  describe('AsyncTestScheduler.run()', () => {
    const assertDeepEquals = (actual: any, expected: any) => {
      expect(actual).deep.equal(expected);
    };

    describe('marble diagrams', () => {
      it('should ignore whitespace', (done: MochaDone) => {
        const testScheduler = new AsyncTestScheduler(assertDeepEquals);

        testScheduler.run(async ({ cold, expectObservable, expectSubscriptions }) => {
          const input = cold('  -a - b -    c |       ');
          const output = input.pipe(
            concatMap(d => of(d).pipe(
              delay(10)
            ))
          );
          const expected = '     -- 9ms a 9ms b 9ms (c|) ';

          expectObservable(output).toBe(expected);
          expectSubscriptions(input.subscriptions).toBe('  ^- - - - - !');
        }).then(() => done(), done);
      });

      it('should support time progression syntax', (done: MochaDone) => {
        const testScheduler = new AsyncTestScheduler(assertDeepEquals);

        testScheduler.run(async ({ cold, hot, flush, expectObservable, expectSubscriptions }) => {
          const output = cold('10.2ms a 1.2s b 1m c|');
          const expected = '   10.2ms a 1.2s b 1m c|';

          expectObservable(output).toBe(expected);
        }).then(() => done(), done);
      });
    });

    it('should provide the correct helpers', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(async ({ cold, hot, flush, expectObservable, expectSubscriptions }) => {
        expect(cold).to.be.a('function');
        expect(hot).to.be.a('function');
        expect(flush).to.be.a('function');
        expect(expectObservable).to.be.a('function');
        expect(expectSubscriptions).to.be.a('function');

        const obs1 = cold('-a-c-e|');
        const obs2 = hot(' ^-b-d-f|');
        const output = merge(obs1, obs2);
        const expected = ' -abcdef|';

        expectObservable(output).toBe(expected);
        expectSubscriptions(obs1.subscriptions).toBe('^-----!');
        expectSubscriptions(obs2.subscriptions).toBe('^------!');
      }).then(() => done(), done);
    });

    it('should have each frame represent a single virtual millisecond', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(async ({ cold, expectObservable }) => {
        const output = cold('-a-b-c--------|').pipe(
          debounceTime(5)
        );
        const expected = '   ------ 4ms c---|';
        expectObservable(output).toBe(expected);
      }).then(() => done(), done);
    });

    it('should have no maximum frame count', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(async ({ cold, expectObservable }) => {
        const output = cold('-a|').pipe(
          delay(1000 * 10)
        );
        const expected = '   - 10s a|';
        expectObservable(output).toBe(expected);
      }).then(() => done(), done);
    });

    it('should make operators that use AsyncScheduler automatically use TestScheduler for actual scheduling', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(async ({ cold, expectObservable }) => {
        const output = cold('-a-b-c--------|').pipe(
          debounceTime(5)
        );
        const expected = '   ----------c---|';
        expectObservable(output).toBe(expected);
      }).then(() => done(), done);
    });

    it('should flush automatically', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler((actual, expected) => {
        expect(actual).deep.equal(expected);
      });
      testScheduler.run(async ({ cold, expectObservable }) => {
        const output = cold('-a-b-c|').pipe(
          concatMap(d => of(d).pipe(
            delay(10)
          ))
        );

        const expected = '   -- 9ms a 9ms b 9ms (c|)';
        expectObservable(output).toBe(expected);

        expect(testScheduler['flushTests'].length).to.equal(1);
        expect(testScheduler['actions'].length).to.equal(1);
      }).then(() => {
        expect(testScheduler['flushTests'].length).to.equal(0);
        expect(testScheduler['actions'].length).to.equal(0);
        done();
      }, done);
    });

    it('should support explicit flushing', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(async ({ cold, expectObservable, flush }) => {
        const output = cold('-a-b-c|').pipe(
          concatMap(d => of(d).pipe(
            delay(10)
          ))
        );
        const expected = '   -- 9ms a 9ms b 9ms (c|)';
        expectObservable(output).toBe(expected);

        expect(testScheduler['flushTests'].length).to.equal(1);
        expect(testScheduler['actions'].length).to.equal(1);

        await flush();

        expect(testScheduler['flushTests'].length).to.equal(0);
        expect(testScheduler['actions'].length).to.equal(0);
      }).then(() => {
        expect(testScheduler['flushTests'].length).to.equal(0);
        expect(testScheduler['actions'].length).to.equal(0);
        done();
      }, done);
    });

    it('should pass-through return values, e.g. Promises', (done) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(async () => {
        return Promise.resolve('foo');
      }).then(value => {
        expect(value).to.equal('foo');
        done();
      }, done);
    });

    it('should restore changes upon thrown errors', (done) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      const frameTimeFactor = AsyncTestScheduler['frameTimeFactor'];
      const maxFrames = testScheduler.maxFrames;
      const runMode = testScheduler['runMode'];
      const delegate = AsyncScheduler.delegate;

      testScheduler.run(async () => {
        throw new Error('kaboom!');
      }).then(() => done(new Error('Expected an error to be thrown')), (error: Error) => {
        expect(error.message).to.equal('kaboom!');
        expect(AsyncTestScheduler['frameTimeFactor']).to.equal(frameTimeFactor);
        expect(testScheduler.maxFrames).to.equal(maxFrames);
        expect(testScheduler['runMode']).to.equal(runMode);
        expect(AsyncScheduler.delegate).to.equal(delegate);
        done();
      });
    });

    it('should flush expectations correctly', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);
      testScheduler.run(async ({ cold, expectObservable, flush }) => {
        expectObservable(cold('-x')).toBe('-x');
        expectObservable(cold('-y')).toBe('-y');
        const expectation = expectObservable(cold('-z'));
        await flush();
        expectation.toBe('-q');
      }).then(() => done(new Error('Expected error')), () => done());
    });

    it('should allow testing Observable.fromPromise()', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);
      testScheduler.run(async ({ expectObservable} ) => {
        const observable = from(Promise.resolve(42)).pipe(delay(10));
        expectObservable(observable).toBe(' 10ms (x|)', {x: 42});
      }).then(() => done(), done);
    });

    it('should allow mixing promises and observables in tests', (done: MochaDone) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);
      testScheduler.run(async ({ expectObservable} ) => {
        const observable = from(Promise.resolve(42)).pipe(
          delay(10),
          switchMap(value => from(Promise.resolve(43)).pipe(
            delay(10),
            startWith(value)
          ))
        );
        expectObservable(observable).toBe(' 10ms x 9ms (y|)', {x: 42, y: 43});
      }).then(() => done(), done);
    });
  });
});
