"use strict";

class StageNumbers {
  constructor(numbers = [], latest = 0) {
    this.numbers = new Set();
    if (!Number.isSafeInteger(latest) || latest < 0)
      throw new Error("阶段最新编号非法");
    this.latest = latest;
    for (const number of numbers) this.add(number);
  }

  add(number) {
    if (!Number.isSafeInteger(number) || number < 1 || this.numbers.has(number))
      throw new Error("阶段编号非法或重复");
    this.numbers.add(number);
    this.latest = Math.max(this.latest, number);
    return number;
  }

  remove(number) {
    this.numbers.delete(number);
  }

  next() {
    let number = 1;
    while (this.numbers.has(number)) number++;
    return this.add(number);
  }

  snapshot() {
    return { latest: this.latest };
  }
}

module.exports = StageNumbers;
