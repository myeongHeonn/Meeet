// 불변 Set 갱신 헬퍼. React 상태의 Set을 직접 변형하지 않고 새 Set을 돌려준다.

// key의 포함 여부를 present로 명시적으로 맞춘 새 Set을 반환한다.
export function withSetItem<T>(set: Set<T>, key: T, present: boolean): Set<T> {
  const next = new Set(set);
  if (present) next.add(key);
  else next.delete(key);
  return next;
}

// key의 포함 여부를 뒤집은 새 Set을 반환한다.
export function toggleSetItem<T>(set: Set<T>, key: T): Set<T> {
  return withSetItem(set, key, !set.has(key));
}
