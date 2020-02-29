import { expect } from 'chai';
import { AsyncScheduler } from 'rxjs/internal/scheduler/AsyncScheduler';
import { AsyncTestScheduler } from 'rxjs/testing';
import { Observable, Subject, of, merge, Notification } from 'rxjs';
import { delay, debounceTime, concatMap } from 'rxjs/operators';

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
    it('should create a cold observable', () => {
      const expected = ['A', 'B'];
      const scheduler = new AsyncTestScheduler(null!);
      const source = scheduler.createColdObservable('--a---b--|', { a: 'A', b: 'B' });
      expect(source).to.be.an.instanceOf(Observable);
      source.subscribe(x => {
        expect(x).to.equal(expected.shift());
      });
      scheduler.flush();
      expect(expected.length).to.equal(0);
    });
  });

  describe('createHotObservable()', () => {
    it('should create a hot observable', () => {
      const expected = ['A', 'B'];
      const scheduler = new AsyncTestScheduler(null!);
      const source = scheduler.createHotObservable('--a---b--|', { a: 'A', b: 'B' });
      expect(source).to.be.an.instanceof(Subject);
      source.subscribe(x => {
        expect(x).to.equal(expected.shift());
      });
      scheduler.flush();
      expect(expected.length).to.equal(0);
    });
  });
  describe('AsyncTestScheduler.run()', () => {
    const assertDeepEquals = (actual: any, expected: any) => {
      expect(actual).deep.equal(expected);
    };

    describe('marble diagrams', () => {
      it('should ignore whitespace', () => {
        const testScheduler = new AsyncTestScheduler(assertDeepEquals);

        testScheduler.run(({ cold, expectObservable, expectSubscriptions }) => {
          const input = cold('  -a - b -    c |       ');
          const output = input.pipe(
            concatMap(d => of(d).pipe(
              delay(10)
            ))
          );
          const expected = '     -- 9ms a 9ms b 9ms (c|) ';

          expectObservable(output).toBe(expected);
          expectSubscriptions(input.subscriptions).toBe('  ^- - - - - !');
        });
      });

      it('should support time progression syntax', () => {
        const testScheduler = new AsyncTestScheduler(assertDeepEquals);

        testScheduler.run(({ cold, hot, flush, expectObservable, expectSubscriptions }) => {
          const output = cold('10.2ms a 1.2s b 1m c|');
          const expected = '   10.2ms a 1.2s b 1m c|';

          expectObservable(output).toBe(expected);
        });
      });
    });

    it('should provide the correct helpers', () => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(({ cold, hot, flush, expectObservable, expectSubscriptions }) => {
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
      });
    });

    it('should have each frame represent a single virtual millisecond', () => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(({ cold, expectObservable }) => {
        const output = cold('-a-b-c--------|').pipe(
          debounceTime(5)
        );
        const expected = '   ------ 4ms c---|';
        expectObservable(output).toBe(expected);
      });
    });

    it('should have no maximum frame count', () => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(({ cold, expectObservable }) => {
        const output = cold('-a|').pipe(
          delay(1000 * 10)
        );
        const expected = '   - 10s a|';
        expectObservable(output).toBe(expected);
      });
    });

    it('should make operators that use AsyncScheduler automatically use TestScheduler for actual scheduling', () => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(({ cold, expectObservable }) => {
        const output = cold('-a-b-c--------|').pipe(
          debounceTime(5)
        );
        const expected = '   ----------c---|';
        expectObservable(output).toBe(expected);
      });
    });

    it('should flush automatically', () => {
      const testScheduler = new AsyncTestScheduler((actual, expected) => {
        expect(actual).deep.equal(expected);
      });
      testScheduler.run(({ cold, expectObservable }) => {
        const output = cold('-a-b-c|').pipe(
          concatMap(d => of(d).pipe(
            delay(10)
          ))
        );
        const expected = '   -- 9ms a 9ms b 9ms (c|)';
        expectObservable(output).toBe(expected);

        expect(testScheduler['flushTests'].length).to.equal(1);
        expect(testScheduler['actions'].length).to.equal(1);
      });

      expect(testScheduler['flushTests'].length).to.equal(0);
      expect(testScheduler['actions'].length).to.equal(0);
    });

    it('should support explicit flushing', () => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(({ cold, expectObservable, flush }) => {
        const output = cold('-a-b-c|').pipe(
          concatMap(d => of(d).pipe(
            delay(10)
          ))
        );
        const expected = '   -- 9ms a 9ms b 9ms (c|)';
        expectObservable(output).toBe(expected);

        expect(testScheduler['flushTests'].length).to.equal(1);
        expect(testScheduler['actions'].length).to.equal(1);

        flush();

        expect(testScheduler['flushTests'].length).to.equal(0);
        expect(testScheduler['actions'].length).to.equal(0);
      });

      expect(testScheduler['flushTests'].length).to.equal(0);
      expect(testScheduler['actions'].length).to.equal(0);
    });

    it('should pass-through return values, e.g. Promises', (done) => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      testScheduler.run(() => {
        return Promise.resolve('foo');
      }).then(value => {
        expect(value).to.equal('foo');
        done();
      });
    });

    it('should restore changes upon thrown errors', () => {
      const testScheduler = new AsyncTestScheduler(assertDeepEquals);

      const frameTimeFactor = AsyncTestScheduler['frameTimeFactor'];
      const maxFrames = testScheduler.maxFrames;
      const runMode = testScheduler['runMode'];
      const delegate = AsyncScheduler.delegate;

      try {
        testScheduler.run(() => {
          throw new Error('kaboom!');
        });
      } catch { /* empty */ }

      expect(AsyncTestScheduler['frameTimeFactor']).to.equal(frameTimeFactor);
      expect(testScheduler.maxFrames).to.equal(maxFrames);
      expect(testScheduler['runMode']).to.equal(runMode);
      expect(AsyncScheduler.delegate).to.equal(delegate);
    });

    it('should flush expectations correctly', () => {
      expect(() => {
        const testScheduler = new AsyncTestScheduler(assertDeepEquals);
        testScheduler.run(({ cold, expectObservable, flush }) => {
          expectObservable(cold('-x')).toBe('-x');
          expectObservable(cold('-y')).toBe('-y');
          const expectation = expectObservable(cold('-z'));
          flush();
          expectation.toBe('-q');
        });
      }).to.throw();
    });
  });
});
