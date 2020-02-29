import * as index from 'rxjs/testing';
import { expect } from 'chai';

describe('index', () => {
  it('should export TestScheduler', () => {
    expect(index.TestScheduler).to.exist;
  });

  it('should export AsyncTestScheduler', () => {
    expect(index.AsyncTestScheduler).to.exist;
  });
});
