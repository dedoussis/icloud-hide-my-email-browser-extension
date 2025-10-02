const hasOwn = Object.prototype.hasOwnProperty;

type AnyRecord = Record<string | number | symbol, unknown>;

const deepEqualInternal = (
  a: unknown,
  b: unknown,
  stack: WeakMap<object, object>
): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (a === null || b === null) {
    return false;
  }

  if (typeof a !== 'object') {
    return false;
  }

  const objectA = a as object;
  const objectB = b as object;

  if (stack.get(objectA) === objectB) {
    return true;
  }

  stack.set(objectA, objectB);

  if (Array.isArray(objectA)) {
    if (!Array.isArray(objectB)) {
      return false;
    }

    if (objectA.length !== objectB.length) {
      return false;
    }

    for (let index = 0; index < objectA.length; index += 1) {
      if (!deepEqualInternal(objectA[index], objectB[index], stack)) {
        return false;
      }
    }

    return true;
  }

  if (objectA instanceof Date && objectB instanceof Date) {
    return objectA.getTime() === objectB.getTime();
  }

  const recordA = objectA as AnyRecord;
  const recordB = objectB as AnyRecord;

  if (Object.getPrototypeOf(recordA) !== Object.getPrototypeOf(recordB)) {
    return false;
  }

  const keysA = Reflect.ownKeys(recordA);
  const keysB = Reflect.ownKeys(recordB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!hasOwn.call(recordB, key)) {
      return false;
    }

    if (
      !deepEqualInternal(
        recordA[key as keyof AnyRecord],
        recordB[key as keyof AnyRecord],
        stack
      )
    ) {
      return false;
    }
  }

  return true;
};

export const deepEqual = (a: unknown, b: unknown): boolean =>
  deepEqualInternal(a, b, new WeakMap());

export default deepEqual;
