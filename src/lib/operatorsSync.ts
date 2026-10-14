import type { Operator } from '../types';
import { INITIAL_OPERATORS } from '../data/initialOperators';

export function operatorPassword(op: Operator | undefined | null): string {
  return String(op?.password ?? '').trim();
}

export function isOperatorRemoved(op: Operator | undefined | null): boolean {
  return Boolean(op && String(op.removedAt || '').trim());
}

export function visibleOperators(ops: Operator[]): Operator[] {
  return (ops || []).filter((op) => op && !isOperatorRemoved(op));
}

export function isDemoSeedList(ops: Operator[]): boolean {
  if (!Array.isArray(ops) || ops.length !== INITIAL_OPERATORS.length) return false;
  const byId = new Map(INITIAL_OPERATORS.map((o) => [o.id, o]));
  for (const op of ops) {
    const seed = byId.get(op.id);
    if (!seed) return false;
    if (String(op.username || '').toLowerCase() !== seed.username.toLowerCase()) return false;
    if (operatorPassword(op) !== operatorPassword(seed)) return false;
  }
  return true;
}

function usernameKey(op: Operator | undefined | null): string {
  return String(op?.username || '').trim().toLowerCase();
}

/** Nube gana en ficha; si la nube viene sin contraseña, se conserva la de la caja. */
export function pickRicherOperator(cloud: Operator, local: Operator): Operator {
  const password = operatorPassword(cloud) || operatorPassword(local);
  const branchIds =
    Array.isArray(cloud.branchIds) && cloud.branchIds.length > 0
      ? cloud.branchIds
      : local.branchIds;
  const removedAt = cloud.removedAt || local.removedAt;
  return {
    ...local,
    ...cloud,
    name: cloud.name || local.name,
    username: cloud.username || local.username,
    password: password || undefined,
    branchIds,
    role: cloud.role || local.role,
    moduleIds: cloud.moduleIds && cloud.moduleIds.length > 0 ? cloud.moduleIds : local.moduleIds,
    isMainAdmin: cloud.isMainAdmin ?? local.isMainAdmin,
    createdAt: cloud.createdAt || local.createdAt,
    removedAt
  };
}

function samePersonInCloud(op: Operator, cloud: Operator[]): boolean {
  const user = usernameKey(op);
  return cloud.some((c) => c.id === op.id || (user && usernameKey(c) === user));
}

/**
 * Une la lista de la caja con la de Firestore.
 * Una nube incompleta o vacía no borra usuarios locales.
 * Los usuarios de demostración (admin/juan/maria/carlos) no se suben a producción.
 */
export function mergeOperatorLists(
  local: Operator[],
  cloud: Operator[],
  session?: Operator | null
): { merged: Operator[]; missingInCloud: Operator[] } {
  const localList = Array.isArray(local) ? local.filter((o) => o?.id) : [];
  const cloudList = Array.isArray(cloud) ? cloud.filter((o) => o?.id) : [];
  const seedLocal = isDemoSeedList(localList);
  const seedIds = new Set(INITIAL_OPERATORS.map((o) => o.id));

  const merged = new Map<string, Operator>();
  const cloudByUsername = new Map<string, Operator>();

  for (const row of cloudList) {
    merged.set(row.id, { ...row });
    const key = usernameKey(row);
    if (key) cloudByUsername.set(key, row);
  }

  const missingInCloud: Operator[] = [];

  const absorbLocal = (row: Operator, allowAdd: boolean) => {
    const existing = merged.get(row.id);
    if (existing) {
      merged.set(row.id, pickRicherOperator(existing, row));
      return;
    }
    const byUser = usernameKey(row) ? cloudByUsername.get(usernameKey(row)) : undefined;
    if (byUser) {
      const current = merged.get(byUser.id) || byUser;
      merged.set(byUser.id, pickRicherOperator(current, { ...row, id: byUser.id }));
      return;
    }
    if (!allowAdd) return;
    merged.set(row.id, { ...row });
    if (!isOperatorRemoved(row) && !samePersonInCloud(row, cloudList)) {
      missingInCloud.push(row);
    }
  };

  for (const row of localList) {
    const isUneditedSeed = seedLocal && seedIds.has(row.id);
    absorbLocal(row, !isUneditedSeed);
  }

  if (session?.id && !isOperatorRemoved(session)) {
    absorbLocal(session, true);
  }

  return { merged: Array.from(merged.values()), missingInCloud };
}

export function operatorsNeedPersist(previous: Operator[], next: Operator[]): boolean {
  if (previous.length !== next.length) return true;
  const prevMap = new Map(previous.map((o) => [o.id, o]));
  for (const row of next) {
    const prev = prevMap.get(row.id);
    if (!prev) return true;
    if (operatorPassword(prev) !== operatorPassword(row)) return true;
    if (prev.username !== row.username || prev.name !== row.name) return true;
    if (prev.role !== row.role) return true;
    if (String(prev.removedAt || '') !== String(row.removedAt || '')) return true;
    const prevBranches = (prev.branchIds || []).join(',');
    const nextBranches = (row.branchIds || []).join(',');
    if (prevBranches !== nextBranches) return true;
  }
  return false;
}
