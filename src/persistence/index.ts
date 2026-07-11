// Single shared driver instance. Metro resolves './driver' to driver.web.ts
// on web and driver.ts (SQLite) on iOS/Android — no runtime platform switch.

import { createDriver } from './driver';
import type { PersistenceDriver } from '@/persistence/types';

export const persistence: PersistenceDriver = createDriver();
