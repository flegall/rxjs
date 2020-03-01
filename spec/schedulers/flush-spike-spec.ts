import { expect } from 'chai';

describe('flush spike', () => {
  it('should run promises microtasks before setImmediate calls', (done: MochaDone) => {
    let log: string[] = [];

    setImmediate(() => {
      log.push('flush');
    });
    Promise.resolve()
      .then(() => {
        log.push('p1');
        return Promise.resolve();
      }).then(() => {
        log.push('p2');
        return Promise.resolve();
      }).then(() => {
        log.push('p3');
        return Promise.resolve();
      });


    setImmediatePromise(() => {
      expect(log).to.deep.equal(['p1', 'p2', 'p3', 'flush']);
    }).then(() => done(), done);

    function setImmediatePromise(cb: () => void): Promise<void> {
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            cb();
          } catch (e) {
            reject(e)
          }
          resolve();
        })
      })
    }
  });

  it('should run promises microtasks before setTimeout calls', (done: MochaDone) => {
    let log: string[] = [];

    setTimeout(() => {
      log.push('flush');
    });
    Promise.resolve()
      .then(() => {
        log.push('p1');
        return Promise.resolve();
      }).then(() => {
        log.push('p2');
        return Promise.resolve();
      }).then(() => {
        log.push('p3');
        return Promise.resolve();
      });


    setTimeoutPromise(() => {
      expect(log).to.deep.equal(['p1', 'p2', 'p3', 'flush']);
    }).then(() => done(), done);

    function setTimeoutPromise(cb: () => void): Promise<void> {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            cb();
          } catch (e) {
            reject(e)
          }
          resolve();
        })
      })
    }
  });

  it('should complete 3 promises microtasks before a started chain or 10 promises microtasks', (done: MochaDone) => {
    let log: string[] = [];

    executeAfterPromises(10, () => {
      log.push('flush');
    });
    Promise.resolve()
      .then(() => {
        log.push('p1');
        return Promise.resolve();
      }).then(() => {
        log.push('p2');
        return Promise.resolve();
      }).then(() => {
        log.push('p3');
        return Promise.resolve();
      });


    asyncExecuteAfterPromises(() => {
      expect(log).to.deep.equal(['p1', 'p2', 'p3', 'flush']);
    }).then(() => done(), done);

    function executeAfterPromises(count: number, cb: () => void): void {
      let array = [];
      for (let i = 0; i < count; i++) {
        array.push(1);
      }

      array.reduce(
        (promise: Promise<number>, value: number) =>
          promise.then(() => Promise.resolve(value)),
        Promise.resolve(1)
      ).then(cb);
    }

    function asyncExecuteAfterPromises(cb: () => void): Promise<void> {
      return new Promise((resolve, reject) => {
        executeAfterPromises(10, () => {
          try {
            cb();
          } catch (e) {
            reject(e)
          }
          resolve();
        })
      })
    }
  });
});
