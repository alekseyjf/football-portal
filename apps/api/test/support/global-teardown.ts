import {
  assertContractCoverage,
  removeContractJournal,
} from './contract-coverage';
import { openApiDocument } from './openapi-contract';

/** Поля `globalConfig` Jest, якими прогін звужують до частини тестів. */
interface TestSelection {
  testPathPatterns: { isSet(): boolean };
  testNamePattern?: string;
  onlyChanged: boolean;
  onlyFailures: boolean;
  shard?: unknown;
}

/** `test:e2e -- шаблон`, `-t`, `-o`, `-f`, `--shard`: прогнано не все — покриття не рахуємо. */
function isPartialRun(selection: TestSelection): boolean {
  return (
    selection.testPathPatterns.isSet() ||
    Boolean(selection.testNamePattern) ||
    selection.onlyChanged ||
    selection.onlyFailures ||
    selection.shard !== undefined
  );
}

/** Раз на прогін (jest `globalTeardown`): повний прогін — з перевіркою покриття контракту. */
export default function globalTeardown(globalConfig: TestSelection): void {
  try {
    if (!isPartialRun(globalConfig)) {
      assertContractCoverage(openApiDocument().paths);
    }
  } finally {
    removeContractJournal();
  }
}
