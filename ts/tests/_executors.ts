import { DefaultExecutor, type WriteOp, type WritePlan, type WritePlanExecutor } from "../src/write-plan.js";

/** Records every executed plan, then delegates to DefaultExecutor. */
export class RecordingExecutor implements WritePlanExecutor {
  readonly inner: DefaultExecutor;
  readonly plans: WriteOp[][] = [];

  constructor(root: string) {
    this.inner = new DefaultExecutor(root);
  }

  execute(plan: WritePlan): void {
    this.plans.push([...plan]);
    this.inner.execute(plan);
  }
}
